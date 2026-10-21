import { describe, expect, it } from "@jest/globals";

import { isValidCnpj, isValidCpf, isValidDocument, normalizeDocument } from "./document.js";

describe("normalizeDocument", () => {
  it("removes punctuation and spaces and uppercases letters", () => {
    expect(normalizeDocument(" 529.982.247-25 ")).toBe("52998224725");
    expect(normalizeDocument("12.abc.345/01de-35")).toBe("12ABC34501DE35");
  });
});

describe("isValidCpf", () => {
  it("accepts a CPF with valid check digits", () => {
    expect(isValidCpf("52998224725")).toBe(true);
  });

  it("rejects wrong check digits, wrong length, letters and repeated digits", () => {
    expect(isValidCpf("52998224724")).toBe(false);
    expect(isValidCpf("5299822472")).toBe(false);
    expect(isValidCpf("5299822472A")).toBe(false);
    expect(isValidCpf("11111111111")).toBe(false);
  });
});

describe("isValidCnpj", () => {
  it("accepts a numeric CNPJ with valid check digits", () => {
    expect(isValidCnpj("11222333000181")).toBe(true);
  });

  it("accepts an alphanumeric CNPJ (Receita Federal format issued since July 2026)", () => {
    expect(isValidCnpj("12ABC34501DE35")).toBe(true);
  });

  it("rejects wrong check digits, letters in the check digits, wrong length and repeated digits", () => {
    expect(isValidCnpj("11222333000182")).toBe(false);
    expect(isValidCnpj("12ABC34501DE3A")).toBe(false);
    expect(isValidCnpj("1122233300018")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
  });
});

describe("isValidDocument", () => {
  it("validates a CPF for PF and a CNPJ for PJ", () => {
    expect(isValidDocument("PF", "52998224725")).toBe(true);
    expect(isValidDocument("PJ", "11222333000181")).toBe(true);
    expect(isValidDocument("PF", "11222333000181")).toBe(false);
    expect(isValidDocument("PJ", "52998224725")).toBe(false);
  });
});
