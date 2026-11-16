import { describe, it, expect } from "vitest";
import {
  countWeekdaysInMonth,
  subscriberSessionPrice,
  subscriberValueForSessions,
} from "@/lib/bookings";

describe("valor do mensalista em meses de 4 e 5 semanas", () => {
  it("conta quantas vezes o dia da semana cai no mês", () => {
    // Novembro/2026 começa num domingo: 5 domingos e 5 segundas, 4 terças.
    expect(countWeekdaysInMonth("2026-11", [0])).toBe(5);
    expect(countWeekdaysInMonth("2026-11", [1])).toBe(5);
    expect(countWeekdaysInMonth("2026-11", [2])).toBe(4);
    // Fevereiro/2026 tem exatamente 4 de cada.
    expect(countWeekdaysInMonth("2026-02", [0, 1, 2, 3, 4, 5, 6])).toBe(28);
    // Dois dias na semana: soma os dois.
    expect(countWeekdaysInMonth("2026-11", [1, 2])).toBe(9);
  });

  it("valor cadastrado vale 4 semanas; a 5a cobra proporcional", () => {
    const sub = { price: 200, weekdays: [1] };
    expect(subscriberSessionPrice(sub)).toBe(50);
    expect(subscriberValueForSessions(sub, 4)).toBe(200);
    expect(subscriberValueForSessions(sub, 5)).toBe(250);
  });

  it("com dois dias por semana o valor base cobre 8 sessões", () => {
    const sub = { price: 320, weekdays: [1, 3] };
    expect(subscriberSessionPrice(sub)).toBe(40);
    expect(subscriberValueForSessions(sub, 8)).toBe(320);
    expect(subscriberValueForSessions(sub, 9)).toBe(360);
  });

  it("sem valor ou sem dias não divide por zero", () => {
    expect(subscriberSessionPrice({ price: 0, weekdays: [1] })).toBe(0);
    expect(subscriberSessionPrice({ price: 100, weekdays: [] })).toBe(0);
  });
});
