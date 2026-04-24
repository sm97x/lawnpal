import {
  BLE_SENSOR_CHARACTERISTIC_UUID,
  BLE_SENSOR_DATA_PACKET_TYPE,
  BLE_SENSOR_DEVICE_NAME,
  BLE_SENSOR_PACKET_LENGTH,
  BLE_SENSOR_SERVICE_UUID,
  decodeBlePacket,
  makeId,
  normalizeBleUuid,
  parseBleReadingPacket,
  type SensorDevice,
  type SensorProvider,
  type SensorReading,
  type TakeReadingInput
} from "@lawnpal/core";
import { NativeModules, PermissionsAndroid, Platform } from "react-native";
import {
  BleError,
  BleManager,
  ScanMode,
  State,
  type Device,
  type Subscription
} from "react-native-ble-plx";

const BLE_LOG_PREFIX = "[LawnPal BLE]";
const SCAN_TIMEOUT_MS = 6500;
const POWER_ON_TIMEOUT_MS = 5000;
const ANDROID_TARGET_MTU = 64;
const BLE_NATIVE_BUILD_MESSAGE =
  "BLE sensor mode requires a native iOS or Android development build. Expo Go does not include the LawnPal BLE native module.";

type DeviceMatch = {
  device: Device;
  matchedByName: boolean;
  matchedByService: boolean;
};

export class BleSensorProvider implements SensorProvider {
  readonly kind = "ble" as const;

  private manager: BleManager | null = null;
  private connectedDevice: Device | null = null;
  private connectedServiceUuid: string | null = null;
  private connectedCharacteristicUuid: string | null = null;

  async scanDevices(): Promise<SensorDevice[]> {
    await this.ensureReadyForBle();
    await this.stopScanSafely();

    const manager = this.getManager();
    const discoveredDevices = new Map<string, Device>();

    return await new Promise<SensorDevice[]>((resolve, reject) => {
      let settled = false;

      const finish = async (error?: Error) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeoutHandle);
        await this.stopScanSafely();

        if (error) {
          reject(error);
          return;
        }

        const matches = Array.from(discoveredDevices.values())
          .map((device) => this.matchDevice(device))
          .filter((match) => match.matchedByName || match.matchedByService)
          .sort((left, right) => this.rankMatch(right) - this.rankMatch(left));

        if (matches.length === 0) {
          this.logDebug("Scan completed without a BEL-YC01 match", {
            discoveredDevices: Array.from(discoveredDevices.values()).map((device) =>
              this.describeDevice(device)
            )
          });
        } else {
          this.logDebug("Scan completed with matching devices", {
            matches: matches.map((match) => ({
              ...this.describeDevice(match.device),
              matchedByName: match.matchedByName,
              matchedByService: match.matchedByService
            }))
          });
        }

        resolve(matches.map((match) => this.toSensorDevice(match.device)));
      };

      const timeoutHandle = setTimeout(() => {
        void finish();
      }, SCAN_TIMEOUT_MS);

      void manager
        .startDeviceScan(
          null,
          {
            allowDuplicates: false,
            scanMode: ScanMode.LowLatency
          },
          (error, device) => {
            if (error) {
              void finish(new Error(this.describeBleError("BLE scan failed.", error)));
              return;
            }

            if (!device) {
              return;
            }

            discoveredDevices.set(device.id, device);

            const match = this.matchDevice(device);
            if (match.matchedByName || match.matchedByService) {
              this.logDebug("Matched device during scan", {
                ...this.describeDevice(device),
                matchedByName: match.matchedByName,
                matchedByService: match.matchedByService
              });
            }
          }
        )
        .catch((error: unknown) => {
          void finish(
            new Error(this.describeBleError("Unable to start BLE scan.", error))
          );
        });
    });
  }

  async connect(deviceId: string): Promise<void> {
    await this.ensureReadyForBle();
    await this.stopScanSafely();
    await this.disconnect();

    const manager = this.getManager();
    let device: Device | null = null;

    try {
      device = await manager.connectToDevice(deviceId, this.getConnectionOptions());

      if (Platform.OS === "android") {
        try {
          device = await device.requestMTU(ANDROID_TARGET_MTU);
        } catch (error) {
          this.logDebug("MTU negotiation skipped after connect", {
            deviceId,
            error: this.describeBleError("MTU negotiation failed.", error)
          });
        }
      }

      device = await device.discoverAllServicesAndCharacteristics();

      const services = await device.services();
      const service = services.find(
        (candidate) =>
          normalizeBleUuid(candidate.uuid) === normalizeBleUuid(BLE_SENSOR_SERVICE_UUID)
      );

      if (!service) {
        throw new Error(
          `Connected device does not expose service ${BLE_SENSOR_SERVICE_UUID}.`
        );
      }

      const characteristics = await device.characteristicsForService(service.uuid);
      const characteristic = characteristics.find(
        (candidate) =>
          normalizeBleUuid(candidate.uuid) ===
          normalizeBleUuid(BLE_SENSOR_CHARACTERISTIC_UUID)
      );

      if (!characteristic) {
        throw new Error(
          `Connected device does not expose characteristic ${BLE_SENSOR_CHARACTERISTIC_UUID} on service ${BLE_SENSOR_SERVICE_UUID}.`
        );
      }

      this.connectedDevice = device;
      this.connectedServiceUuid = service.uuid;
      this.connectedCharacteristicUuid = characteristic.uuid;

      this.logDebug("Connected to BEL-YC01 sensor", {
        ...this.describeDevice(device),
        mtu: device.mtu,
        serviceUuid: service.uuid,
        characteristicUuid: characteristic.uuid
      });
    } catch (error) {
      await this.disconnectDeviceSafely(device);
      await this.disconnect();
      throw new Error(this.describeBleError("Unable to connect to the LawnPal BLE sensor.", error));
    }
  }

  async disconnect(): Promise<void> {
    const device = this.connectedDevice;

    this.connectedDevice = null;
    this.connectedServiceUuid = null;
    this.connectedCharacteristicUuid = null;

    if (!device) {
      return;
    }

    try {
      const isConnected = await device.isConnected().catch(() => false);
      if (isConnected) {
        await device.cancelConnection();
        this.logDebug("Disconnected from sensor", this.describeDevice(device));
      }
    } catch (error) {
      this.logDebug("Disconnect completed with a non-fatal BLE error", {
        ...this.describeDevice(device),
        error: this.describeBleError("Disconnect warning.", error)
      });
    }
  }

  async takeReading(input: TakeReadingInput): Promise<SensorReading> {
    if (!this.connectedDevice || !this.connectedServiceUuid || !this.connectedCharacteristicUuid) {
      throw new Error("BLE sensor is not connected.");
    }

    try {
      const characteristic = await this.connectedDevice.readCharacteristicForService(
        this.connectedServiceUuid,
        this.connectedCharacteristicUuid
      );

      if (!characteristic.value) {
        throw new Error(
          `Characteristic ${BLE_SENSOR_CHARACTERISTIC_UUID} returned no value.`
        );
      }

      const encodedBytes = this.base64ToBytes(characteristic.value);
      if (encodedBytes.length !== BLE_SENSOR_PACKET_LENGTH) {
        throw new Error(
          `Characteristic ${BLE_SENSOR_CHARACTERISTIC_UUID} returned ${encodedBytes.length} bytes; expected ${BLE_SENSOR_PACKET_LENGTH}.`
        );
      }

      const decodedBytes = decodeBlePacket(encodedBytes);
      const parsedPacket = parseBleReadingPacket(decodedBytes);

      this.logDebug("Read and decoded BLE packet", {
        encodedBytesHex: this.bytesToHex(encodedBytes),
        decodedBytesHex: this.bytesToHex(decodedBytes),
        packetType: parsedPacket.packetType,
        packetKind: parsedPacket.packetKind,
        protocolVersion: parsedPacket.protocolVersion,
        productCode: parsedPacket.productCode,
        rawFields: parsedPacket.rawFields,
        derivedFields: parsedPacket.derivedFields,
        flags: parsedPacket.flags,
        checksum: parsedPacket.checksum,
        metrics: parsedPacket.metrics
      });

      if (parsedPacket.packetType !== BLE_SENSOR_DATA_PACKET_TYPE) {
        throw new Error(
          `Expected BLE sensor data packet type 1 but received ${parsedPacket.packetType}.`
        );
      }

      if (parsedPacket.protocolVersion !== 2) {
        throw new Error(
          `Unexpected BLE protocol marker ${parsedPacket.protocolVersion}; expected 2.`
        );
      }

      if (!parsedPacket.checksum.matches) {
        throw new Error(
          `BLE packet checksum mismatch. actual=${parsedPacket.checksum.actual} expected=${parsedPacket.checksum.expected} wholePacketXor=${parsedPacket.checksum.wholePacketXor}`
        );
      }

      return {
        id: makeId("reading"),
        zoneId: input.zoneId,
        provider: "ble",
        scenarioKey: "real-sensor",
        takenAt: new Date().toISOString(),
        metrics: parsedPacket.metrics
      };
    } catch (error) {
      throw new Error(this.describeBleError("Unable to read live BLE sensor data.", error));
    }
  }

  private getManager(): BleManager {
    if (!NativeModules.BlePlx) {
      throw new Error(BLE_NATIVE_BUILD_MESSAGE);
    }

    if (!this.manager) {
      this.manager = new BleManager();
    }

    return this.manager;
  }

  private async ensureReadyForBle(): Promise<void> {
    await this.requestAndroidPermissionsIfNeeded();
    await this.ensureBluetoothPoweredOn();
  }

  private async requestAndroidPermissionsIfNeeded(): Promise<void> {
    if (Platform.OS !== "android") {
      return;
    }

    const sdkVersion =
      typeof Platform.Version === "number"
        ? Platform.Version
        : Number.parseInt(String(Platform.Version), 10);

    const permissions =
      sdkVersion >= 31
        ? [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
          ]
        : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

    const results = await PermissionsAndroid.requestMultiple(permissions);
    const deniedPermissions = permissions.filter(
      (permission) => results[permission] !== PermissionsAndroid.RESULTS.GRANTED
    );

    if (deniedPermissions.length > 0) {
      throw new Error(
        `Bluetooth permissions denied: ${deniedPermissions.join(", ")}. Grant the permission and retry.`
      );
    }
  }

  private async ensureBluetoothPoweredOn(): Promise<void> {
    const manager = this.getManager();
    const state = await manager.state();

    if (state === State.PoweredOn) {
      return;
    }

    if (state === State.Unknown || state === State.Resetting) {
      await this.waitForBluetoothReady(manager);
      return;
    }

    throw new Error(this.describeStateProblem(state));
  }

  private waitForBluetoothReady(manager: BleManager): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      let subscription: Subscription | null = null;

      const timeoutHandle = setTimeout(() => {
        cleanup();
        reject(new Error("Timed out waiting for Bluetooth to become ready."));
      }, POWER_ON_TIMEOUT_MS);

      const cleanup = () => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeoutHandle);
        subscription?.remove();
      };

      subscription = manager.onStateChange(
        (nextState) => {
          if (nextState === State.PoweredOn) {
            cleanup();
            resolve();
            return;
          }

          if (nextState !== State.Unknown && nextState !== State.Resetting) {
            cleanup();
            reject(new Error(this.describeStateProblem(nextState)));
          }
        },
        true
      );

      if (settled) {
        subscription.remove();
      }
    });
  }

  private getConnectionOptions() {
    if (Platform.OS === "android") {
      return {
        autoConnect: false,
        requestMTU: ANDROID_TARGET_MTU
      };
    }

    return undefined;
  }

  private matchDevice(device: Device): DeviceMatch {
    const normalizedTargetName = BLE_SENSOR_DEVICE_NAME.toLowerCase();
    const possibleNames = [device.name, device.localName]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase());
    const matchedByName = possibleNames.some((value) => value.includes(normalizedTargetName));
    const matchedByService = (device.serviceUUIDs ?? []).some(
      (uuid) => normalizeBleUuid(uuid) === normalizeBleUuid(BLE_SENSOR_SERVICE_UUID)
    );

    return {
      device,
      matchedByName,
      matchedByService
    };
  }

  private rankMatch(match: DeviceMatch): number {
    const signalStrength = match.device.rssi ?? -127;
    return (
      (match.matchedByName ? 10_000 : 0) +
      (match.matchedByService ? 1_000 : 0) +
      signalStrength
    );
  }

  private toSensorDevice(device: Device): SensorDevice {
    return {
      id: device.id,
      name: this.getDeviceName(device),
      signalStrength: device.rssi ?? -127,
      provider: "ble"
    };
  }

  private describeDevice(device: Device) {
    return {
      id: device.id,
      name: this.getDeviceName(device),
      rssi: device.rssi ?? null,
      serviceUUIDs: device.serviceUUIDs ?? []
    };
  }

  private getDeviceName(device: Device): string {
    return device.name ?? device.localName ?? "Unnamed BLE device";
  }

  private async stopScanSafely(): Promise<void> {
    if (!this.manager) {
      return;
    }

    try {
      await this.manager.stopDeviceScan();
    } catch (error) {
      this.logDebug("Ignoring stop scan warning", {
        error: this.describeBleError("Stop scan warning.", error)
      });
    }
  }

  private async disconnectDeviceSafely(device: Device | null): Promise<void> {
    if (!device) {
      return;
    }

    try {
      const isConnected = await device.isConnected().catch(() => true);
      if (isConnected) {
        await device.cancelConnection();
      }
    } catch (error) {
      this.logDebug("Ignoring cleanup disconnect warning", {
        ...this.describeDevice(device),
        error: this.describeBleError("Cleanup disconnect warning.", error)
      });
    }
  }

  private describeStateProblem(state: State): string {
    switch (state) {
      case State.PoweredOff:
        return "Bluetooth is turned off. Turn it on and retry.";
      case State.Unauthorized:
        return "Bluetooth permission is not authorized for LawnPal.";
      case State.Unsupported:
        return "This device does not support Bluetooth Low Energy.";
      case State.Resetting:
      case State.Unknown:
        return "Bluetooth is still initializing. Retry in a moment.";
      default:
        return `Bluetooth is not ready: ${state}.`;
    }
  }

  private describeBleError(prefix: string, error: unknown): string {
    if (error instanceof BleError) {
      return `${prefix} ${error.message}${error.reason ? ` (${error.reason})` : ""}`;
    }

    if (error instanceof Error) {
      return `${prefix} ${error.message}`;
    }

    return `${prefix} ${String(error)}`;
  }

  private base64ToBytes(value: string): Uint8Array {
    if (typeof globalThis.atob !== "function") {
      throw new Error("Base64 decoding is unavailable in this native build.");
    }

    const binary = globalThis.atob(value);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  }

  private bytesToHex(value: Uint8Array): string {
    return Array.from(value)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join(" ");
  }

  private logDebug(message: string, data?: unknown): void {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      if (data === undefined) {
        console.log(`${BLE_LOG_PREFIX} ${message}`);
      } else {
        console.log(`${BLE_LOG_PREFIX} ${message}`, data);
      }
    }
  }
}
