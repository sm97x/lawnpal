import type { SensorMetrics } from "../types";

export const BLE_SENSOR_DEVICE_NAME = "BEL-YC01";
export const BLE_SENSOR_SERVICE_UUID = "FF01";
export const BLE_SENSOR_CHARACTERISTIC_UUID = "FF02";
export const BLE_SENSOR_PACKET_LENGTH = 24;
export const BLE_SENSOR_DATA_PACKET_TYPE = 1;
export const BLE_SENSOR_CALIBRATION_PACKET_TYPE = 2;

const BLUETOOTH_BASE_UUID_SUFFIX = "-0000-1000-8000-00805f9b34fb";

export type BlePacketKind = "sensor-data" | "calibration-data" | "unknown";

export type ParsedBleFlags = {
  raw: number;
  phBufferStandard: "7.00" | "6.86";
  holdReadLock: boolean;
  backlightOn: boolean;
  tdsAbove10k: boolean;
  undocumentedBit3: boolean;
  undocumentedBit2: boolean;
  ecAbove20k: boolean;
  ecAbove10k: boolean;
};

export type ParsedBlePacket = {
  packetType: number;
  packetKind: BlePacketKind;
  protocolVersion: number;
  productCode: number;
  metrics: SensorMetrics;
  flags: ParsedBleFlags;
  rawFields: {
    phRaw: number;
    ecRaw: number;
    tdsRaw: number;
    moistureRaw: number;
    lightRaw: number;
    temperatureRaw: number;
    batteryRaw: number;
    humidityRaw: number;
    reservedBytes: [number, number, number];
  };
  derivedFields: {
    tds: {
      value: number;
      unit: "ppm" | "ppt";
    };
    batteryPercent: number;
  };
  checksum: {
    actual: number;
    expected: number;
    matches: boolean;
    wholePacketXor: number;
  };
  decodedBytes: number[];
};

export const normalizeBleUuid = (uuid: string): string => {
  const normalized = uuid.trim().toLowerCase();

  if (normalized.length === 4) {
    return `0000${normalized}${BLUETOOTH_BASE_UUID_SUFFIX}`;
  }

  if (normalized.length === 8) {
    return `${normalized}${BLUETOOTH_BASE_UUID_SUFFIX}`;
  }

  return normalized;
};

export const decodeBlePacket = (input: Uint8Array): Uint8Array => {
  const bytes = new Uint8Array(input);

  for (let i = bytes.length - 1; i > 0; i -= 1) {
    let tmp = bytes[i]!;
    const hibit1 = (tmp & 0x55) << 1;
    const lobit1 = (tmp & 0xaa) >> 1;

    tmp = bytes[i - 1]!;
    const hibit = (tmp & 0x55) << 1;
    const lobit = (tmp & 0xaa) >> 1;

    bytes[i] = (~(hibit1 | lobit)) & 0xff;
    bytes[i - 1] = (~(hibit | lobit1)) & 0xff;
  }

  return bytes;
};

export const xorChecksum = (input: Uint8Array): number => {
  let checksum = 0;

  for (const value of input) {
    checksum ^= value;
  }

  return checksum & 0xff;
};

export const parseFlags = (value: number): ParsedBleFlags => ({
  raw: value,
  phBufferStandard: (value & 0x80) === 0x80 ? "7.00" : "6.86",
  holdReadLock: (value & 0x40) === 0x40,
  backlightOn: (value & 0x20) === 0x20,
  tdsAbove10k: (value & 0x10) === 0x10,
  undocumentedBit3: (value & 0x08) === 0x08,
  undocumentedBit2: (value & 0x04) === 0x04,
  ecAbove20k: (value & 0x02) === 0x02,
  ecAbove10k: (value & 0x01) === 0x01
});

export const parseEcUsCm = (ecRaw: number, flags: ParsedBleFlags): number => {
  if (flags.ecAbove20k) {
    return (ecRaw / 10) * 1000;
  }

  if (flags.ecAbove10k) {
    return (ecRaw / 100) * 1000;
  }

  return ecRaw;
};

export const parseTdsValue = (
  tdsRaw: number,
  flags: ParsedBleFlags
): ParsedBlePacket["derivedFields"]["tds"] => {
  if (flags.tdsAbove10k) {
    return {
      value: tdsRaw / 10,
      unit: "ppt"
    };
  }

  return {
    value: tdsRaw,
    unit: "ppm"
  };
};

export const parseMoistureValue = (moistureRaw: number): number => {
  // TODO: Confirm on real hardware whether moisture is reported as percent, tenths, hundredths, or raw ADC.
  return moistureRaw;
};

export const parseLightLuxValue = (lightRaw: number): number => lightRaw;

export const parseSoilTemperatureCValue = (temperatureRaw: number): number => {
  // TODO: Confirm on real hardware whether soil temperature is raw, /10, or /100.
  return temperatureRaw / 100;
};

export const parseHumidityValue = (humidityRaw: number): number => {
  // TODO: Confirm on real hardware whether humidity is direct percent, tenths, hundredths, or raw.
  return humidityRaw;
};

export const parseBatteryPercent = (batteryRaw: number): number => batteryRaw * 0.125 - 275;

export const getBlePacketKind = (packetType: number): BlePacketKind => {
  if (packetType === BLE_SENSOR_DATA_PACKET_TYPE) {
    return "sensor-data";
  }

  if (packetType === BLE_SENSOR_CALIBRATION_PACKET_TYPE) {
    return "calibration-data";
  }

  return "unknown";
};

export const combineBytes = (highByte: number, lowByte: number): number =>
  ((highByte & 0xff) << 8) | (lowByte & 0xff);

export const parseBleReadingPacket = (packet: Uint8Array): ParsedBlePacket => {
  if (packet.length !== BLE_SENSOR_PACKET_LENGTH) {
    throw new Error(
      `BLE packet must be ${BLE_SENSOR_PACKET_LENGTH} bytes after decoding; received ${packet.length}.`
    );
  }

  const phRaw = combineBytes(packet[3]!, packet[4]!);
  const ecRaw = combineBytes(packet[5]!, packet[6]!);
  const tdsRaw = combineBytes(packet[7]!, packet[8]!);
  const moistureRaw = combineBytes(packet[9]!, packet[10]!);
  const lightRaw = combineBytes(packet[11]!, packet[12]!);
  const temperatureRaw = combineBytes(packet[13]!, packet[14]!);
  const batteryRaw = combineBytes(packet[15]!, packet[16]!);
  const flags = parseFlags(packet[17]!);
  const humidityRaw = combineBytes(packet[18]!, packet[19]!);
  const reservedBytes: [number, number, number] = [packet[20]!, packet[21]!, packet[22]!];
  const expectedChecksum = packet[23]!;
  const actualChecksum = xorChecksum(packet.subarray(0, BLE_SENSOR_PACKET_LENGTH - 1));
  const wholePacketXor = xorChecksum(packet);

  return {
    packetType: packet[0]!,
    packetKind: getBlePacketKind(packet[0]!),
    protocolVersion: packet[1]!,
    productCode: packet[2]!,
    metrics: {
      moisture: parseMoistureValue(moistureRaw),
      soilTemperatureC: parseSoilTemperatureCValue(temperatureRaw),
      ec: parseEcUsCm(ecRaw, flags),
      ph: phRaw / 100,
      lightLux: parseLightLuxValue(lightRaw),
      humidity: parseHumidityValue(humidityRaw)
    },
    flags,
    rawFields: {
      phRaw,
      ecRaw,
      tdsRaw,
      moistureRaw,
      lightRaw,
      temperatureRaw,
      batteryRaw,
      humidityRaw,
      reservedBytes
    },
    derivedFields: {
      tds: parseTdsValue(tdsRaw, flags),
      batteryPercent: parseBatteryPercent(batteryRaw)
    },
    checksum: {
      actual: actualChecksum,
      expected: expectedChecksum,
      matches: actualChecksum === expectedChecksum,
      wholePacketXor
    },
    decodedBytes: Array.from(packet)
  };
};
