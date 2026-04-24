import { describe, expect, it } from "vitest";
import {
  BLE_SENSOR_PACKET_LENGTH,
  combineBytes,
  decodeBlePacket,
  normalizeBleUuid,
  parseBleReadingPacket,
  xorChecksum
} from "../src";

const encodeBlePacket = (input: Uint8Array): Uint8Array => {
  const bytes = new Uint8Array(input);

  for (let index = 0; index < bytes.length - 1; index += 1) {
    let tmp = (~bytes[index]!) & 0xff;
    const hibit = (tmp & 0xaa) >> 1;
    const lobit = (tmp & 0x55) << 1;

    tmp = (~bytes[index + 1]!) & 0xff;
    const hibit1 = (tmp & 0xaa) >> 1;
    const lobit1 = (tmp & 0x55) << 1;

    bytes[index] = (hibit | lobit1) & 0xff;
    bytes[index + 1] = (hibit1 | lobit) & 0xff;
  }

  return bytes;
};

const buildDecodedPacket = (): Uint8Array => {
  const packet = new Uint8Array(BLE_SENSOR_PACKET_LENGTH);
  packet[0] = 1;
  packet[1] = 2;
  packet[2] = 36;
  packet[3] = 0x02;
  packet[4] = 0xae;
  packet[5] = 0x01;
  packet[6] = 0x5e;
  packet[7] = 0x15;
  packet[8] = 0x38;
  packet[9] = 0x02;
  packet[10] = 0x00;
  packet[11] = 0x04;
  packet[12] = 0x00;
  packet[13] = 0x08;
  packet[14] = 0x66;
  packet[15] = 0x0b;
  packet[16] = 0xb8;
  packet[17] = 0xb3;
  packet[18] = 0x00;
  packet[19] = 0x4d;
  packet[20] = 0xaa;
  packet[21] = 0xbb;
  packet[22] = 0xcc;
  packet[23] = xorChecksum(packet.subarray(0, BLE_SENSOR_PACKET_LENGTH - 1));
  return packet;
};

describe("BLE protocol parser", () => {
  it("reverses the vendor encryption transform", () => {
    const decoded = buildDecodedPacket();
    const encoded = encodeBlePacket(decoded);

    expect(decodeBlePacket(encoded)).toEqual(decoded);
  });

  it("normalizes short-form Bluetooth UUIDs", () => {
    expect(normalizeBleUuid("FF01")).toBe("0000ff01-0000-1000-8000-00805f9b34fb");
    expect(normalizeBleUuid("0000FF02")).toBe("0000ff02-0000-1000-8000-00805f9b34fb");
  });

  it("parses a decoded sensor packet into LawnPal metrics and debug fields", () => {
    const packet = buildDecodedPacket();
    const parsed = parseBleReadingPacket(packet);

    expect(parsed.packetType).toBe(1);
    expect(parsed.packetKind).toBe("sensor-data");
    expect(parsed.protocolVersion).toBe(2);
    expect(parsed.productCode).toBe(36);
    expect(parsed.metrics.ph).toBe(6.86);
    expect(parsed.metrics.ec).toBe(35000);
    expect(parsed.metrics.moisture).toBe(512);
    expect(parsed.metrics.lightLux).toBe(1024);
    expect(parsed.metrics.soilTemperatureC).toBeCloseTo(21.5);
    expect(parsed.metrics.humidity).toBe(77);
    expect(parsed.derivedFields.tds.value).toBeCloseTo(543.2);
    expect(parsed.derivedFields.tds.unit).toBe("ppt");
    expect(parsed.derivedFields.batteryPercent).toBeCloseTo(100);
    expect(parsed.flags.phBufferStandard).toBe("7.00");
    expect(parsed.flags.backlightOn).toBe(true);
    expect(parsed.flags.tdsAbove10k).toBe(true);
    expect(parsed.flags.ecAbove20k).toBe(true);
    expect(parsed.flags.ecAbove10k).toBe(true);
    expect(parsed.rawFields.reservedBytes).toEqual([0xaa, 0xbb, 0xcc]);
    expect(parsed.checksum.matches).toBe(true);
    expect(parsed.checksum.wholePacketXor).toBe(0);
  });

  it("exposes checksum mismatches without inventing corrected data", () => {
    const packet = buildDecodedPacket();
    packet[23] = 0;

    const parsed = parseBleReadingPacket(packet);

    expect(parsed.checksum.expected).toBe(0);
    expect(parsed.checksum.actual).toBe(xorChecksum(packet.subarray(0, 23)));
    expect(parsed.checksum.matches).toBe(false);
    expect(parsed.checksum.wholePacketXor).not.toBe(0);
  });

  it("combines high and low bytes consistently", () => {
    expect(combineBytes(0x02, 0xae)).toBe(686);
  });
});
