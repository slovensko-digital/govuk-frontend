/*

§ 2 Rodné číslo
(1)
Rodné číslo je trvalý identifikačný osobný údaj fyzickej osoby (ďalej len osoba), ktorý zabezpečuje jej jednoznačnosť v informačných systémoch.1)
(2)
Rodné číslo sa tvorí z dátumu narodenia osoby a z koncovky, ktorá je rozlišujúcim znakom osôb narodených v tom istom kalendárnom dni.
(3)
Prvé dvojčíslie rodného čísla vyjadruje posledné dve číslice roku narodenia osoby, druhé dvojčíslie vyjadruje číselné označenie mesiaca narodenia osoby (u žien zvýšené o 50), tretie dvojčíslie vyjadruje číselné označenie dňa narodenia osoby v danom kalendárnom mesiaci.
(4)
Rodné číslo pridelené osobe narodenej do 31. decembra 1953 je deväťmiestne s trojmiestnou koncovkou.
(5)
Rodné číslo pridelené osobe narodenej po 1. januári 1954 je desaťmiestne so štvormiestnou koncovkou; pritom celé desaťmiestne rodné číslo musí byť bezo zvyšku deliteľné číslom 11


avsak: https://webdev.zaujimave.info/generator-rodneho-cisla/
- ak bolo RC udelovane po 1954 aj ked sa clovek narodil pred 1954 tak dostane 4 miestny suffix (kontrolnu cifru) - takze nevies rozlisit kedy bol clovek narodeny
- existuje vynimka z delitelnosti 11 ak ma cislo bez kontrolnej cifry zvysok po deleni 11 = 10 tak moze byt kontrolna cifra 0
*/

// const { parseRC } = require("./input-rodne-cislo-parse");
import { parseRC } from "./input-rodne-cislo-parse";

const validInputsBefore1954 = [
  [
    "530101/123",
    {
      year: 1953,
      month: 1,
      day: 1,
      sex: "male",
      suffix: "123"
    }
  ],
  [
    "530101123",
    {
      year: 1953,
      month: 1,
      day: 1,
      sex: "male",
      suffix: "123"
    }
  ],
  [
    "535101123",
    {
      year: 1953,
      month: 1,
      day: 1,
      sex: "female",
      suffix: "123"
    }
  ]
];

const validInputsAfter1954 = [
  [
    "540101/1242",
    {
      year: 1954,
      month: 1,
      day: 1,
      sex: "male",
      suffix: "1242"
    }
  ],
  [
    "545101/1236",
    {
      year: 1954,
      month: 1,
      day: 1,
      sex: "female",
      suffix: "1236"
    }
  ],
  [
    "5401011242",
    {
      year: 1954,
      month: 1,
      day: 1,
      sex: "male",
      suffix: "1242"
    }
  ],
  [
    "5451011247",
    {
      year: 1954,
      month: 1,
      day: 1,
      sex: "female",
      suffix: "1247"
    }
  ]
];

const validInputsAfter2000 = [
  [
    "000101/1252",
    {
      year: 2000,
      month: 1,
      day: 1,
      sex: "male",
      suffix: "1252"
    }
  ],

  [
    "530101/1243",
    {
      year: 2053,
      month: 1,
      day: 1,
      sex: "male",
      suffix: "1243"
    }
  ],
  [
    "535101/1237",
    {
      year: 2053,
      month: 1,
      day: 1,
      sex: "female",
      suffix: "1237"
    }
  ],
  [
    "5301011243",
    {
      year: 2053,
      month: 1,
      day: 1,
      sex: "male",
      suffix: "1243"
    }
  ],
  [
    "5351011237",
    {
      year: 2053,
      month: 1,
      day: 1,
      sex: "female",
      suffix: "1237"
    }
  ]
];

const invalidInputs = [
  ["000101/1251"],
  ["539101/1243"],
  ["535101/12"],
  ["530132240"],
  ["0000000000"],
  ["012312000000000123231"]
];

describe("input-rodne-cislo", () => {
  it.each(validInputsBefore1954)(
    "valid input before 1954 %s",
    (rodneCislo, expected) => {
      expect(parseRC(rodneCislo)).toMatchObject(expected);
    }
  );

  it.each(validInputsAfter1954)(
    "valid input after 1954 %s",
    (rodneCislo, expected) => {
      expect(parseRC(rodneCislo)).toMatchObject(expected);
    }
  );

  it.each(validInputsAfter2000)(
    "valid input after 2000 %s",
    (rodneCislo, expected) => {
      expect(parseRC(rodneCislo)).toMatchObject(expected);
    }
  );

  it.each(invalidInputs)("invalid input %s", rodneCislo => {
    expect(() => parseRC(rodneCislo)).toThrow();
  });
});
