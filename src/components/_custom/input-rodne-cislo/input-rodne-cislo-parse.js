const SUFFIX_CHANGE_YEAR = 54; // 1954
const FEMALE_MONTH_OFFSET = 50;

function parseYear(strYear, strSuffixLength) {
  const intYear = parseInt(strYear);

  if (isNaN(intYear)) {
    throw new Error("Rok nie je číslo");
  }

  let year = null;
  if (intYear >= SUFFIX_CHANGE_YEAR) {
    year = 19 * 100 + intYear;
  } else {
    let century = null;
    if (strSuffixLength == 3) {
      century = 19;
    } else if (strSuffixLength == 4) {
      century = 20;
    }
    year = century * 100 + intYear;
  }
  return year;
}

function parseMonthAndSex(strMonth) {
  const intMonth = parseInt(strMonth);
  let month = null;
  let sex = null;
  if (intMonth > FEMALE_MONTH_OFFSET) {
    month = intMonth - FEMALE_MONTH_OFFSET;
    sex = "female";
  } else {
    month = intMonth;
    sex = "male";
  }

  if (month < 1 || 12 < month) {
    throw new Error("Mesiac nie je v intervale 1-12");
  }
  return { month, sex };
}

function checkDate(year, month, day){

  const date = new Date(year, month, day);
  const isValidDate = date instanceof Date && !isNaN(date);
  if (!isValidDate) {
    throw new Error("Dátum narodenia nie je existujúci dátum");
  }
}

function parseDay(strDay) {
  const day = parseInt(strDay);
  if (day < 1 || 31 < day) {
    throw new Error("Deň nie je v intervale 1-31");
  }
  return day;
}

function checksum(onlyDigits, strSuffixLength){

  if (strSuffixLength == 4) {
    const number = parseInt(onlyDigits);
    if (number % 11 !== 0) {
      // throw new Error("Kontrolný súčet nesedí" + ` ${Math.ceil(number / 11) * 11}`);
      throw new Error("Kontrolný súčet nesedí");
    }
  }
}

export function parseRC(strRodneCislo) {
  const regexpRC = /^(\d{2})(\d{2})(\d{2})(\d{3,4})$/g;
  const onlyDigits = strRodneCislo.replace(/\D/g, "");
  const regexpResult = regexpRC.exec(onlyDigits);

  if (regexpResult === null) {
    throw new Error("Toto nie je rodné číslo");
  }

  const [_, strYear, strMonth, strDay, strSuffix] = regexpResult;

  const year = parseYear(strYear, strSuffix.length);

  /* 
  Month & sex
  */

  const { month, sex } = parseMonthAndSex(strMonth);

  const day = parseDay(strDay);

  checkDate(year, month, day)

  /*
  Checksum
  */
 checksum(onlyDigits, strSuffix.length);

  return {
    year,
    month,
    day,
    // date,
    sex,
    suffix: strSuffix
  };
}

export function isValidRC(strRodneCislo) {
  try {
    parseRC(strRodneCislo);
    return true;
  } catch (e) {
    return false;
  }
}

