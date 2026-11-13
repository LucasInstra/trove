//! Comma-separated bank statements: every bank exports a different dialect,
//! so the caller passes a mapping that says which column is which.
//!
//! The dedupe story is the same as OFX on purpose: without a FITID the key
//! falls back to a fingerprint of the statement, the account and the amount,
//! so reimporting the same file — or the same period from OFX and CSV —
//! inserts nothing new.

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CsvMapping {
    /// One of `,`, `;`, `\t`, `|`.
    pub separator: String,
    /// `auto`, `utf-8`, `latin1` or `windows-1252`.
    pub encoding: String,
    pub has_header: bool,
    pub date_col: usize,
    /// One of `%d/%m/%Y`, `%Y-%m-%d`, `%d-%m-%Y`, `%m/%d/%Y`.
    pub date_format: String,
    pub description_col: usize,
    /// Exactly one of `amount_col` or the `debit_col` + `credit_col` pair.
    pub amount_col: Option<usize>,
    pub debit_col: Option<usize>,
    pub credit_col: Option<usize>,
    /// `,` or `.`.
    pub decimal_sep: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CsvRow {
    pub line_no: usize,
    pub posted_on: String,
    pub description: String,
    pub amount_cents: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CsvIssue {
    pub line_no: usize,
    pub message: String,
}

fn separator_of(mapping: &CsvMapping) -> Result<char, String> {
    let mut chars = mapping.separator.chars();
    match (chars.next(), chars.next()) {
        (Some(sep), None) if [',', ';', '\t', '|'].contains(&sep) => Ok(sep),
        _ => Err("separator must be one of , ; \\t |".to_string()),
    }
}

pub fn validate_mapping(mapping: &CsvMapping) -> Result<(), String> {
    separator_of(mapping)?;
    match mapping.encoding.as_str() {
        "auto" | "utf-8" | "latin1" | "windows-1252" => {}
        other => return Err(format!("unknown encoding: {other}")),
    }
    match mapping.date_format.as_str() {
        "%d/%m/%Y" | "%Y-%m-%d" | "%d-%m-%Y" | "%m/%d/%Y" => {}
        other => return Err(format!("unsupported date format: {other}")),
    }
    match mapping.decimal_sep.as_str() {
        "," | "." => {}
        other => return Err(format!("decimal separator must be , or ., got {other}")),
    }
    let single = mapping.amount_col.is_some();
    let split = mapping.debit_col.is_some() || mapping.credit_col.is_some();
    if single == split {
        return Err("use either amount_col or the debit_col/credit_col pair, not both or neither".to_string());
    }
    if split && (mapping.debit_col.is_none() || mapping.credit_col.is_none()) {
        return Err("debit_col and credit_col go together".to_string());
    }
    Ok(())
}

fn windows_1252(byte: u8) -> char {
    match byte {
        0x80 => '€', 0x82 => '‚', 0x83 => 'ƒ', 0x84 => '„', 0x85 => '…',
        0x86 => '†', 0x87 => '‡', 0x88 => 'ˆ', 0x89 => '‰', 0x8A => 'Š',
        0x8B => '‹', 0x8C => 'Œ', 0x8E => 'Ž', 0x91 => '\u{2018}',
        0x92 => '\u{2019}', 0x93 => '\u{201c}', 0x94 => '\u{201d}',
        0x95 => '•', 0x96 => '–', 0x97 => '—', 0x98 => '˜',
        0x99 => '™', 0x9A => 'š', 0x9B => '›', 0x9C => 'œ',
        0x9E => 'ž', 0x9F => 'Ÿ',
        0x81 | 0x8D | 0x8F | 0x90 | 0x9D => '\u{FFFD}',
        _ => byte as char,
    }
}

pub fn decode_bytes(bytes: &[u8], encoding: &str) -> Result<String, String> {
    let forced = match encoding {
        "utf-8" => Some(false),
        "latin1" | "windows-1252" => Some(true),
        "auto" => None,
        other => return Err(format!("unknown encoding: {other}")),
    };
    if forced == Some(false) {
        return std::str::from_utf8(bytes)
            .map(|text| text.to_string())
            .map_err(|_| "file is not valid UTF-8".to_string());
    }
    if let Ok(text) = std::str::from_utf8(bytes) {
        return Ok(text.to_string());
    }
    if forced == Some(false) {
        return Err("file is not valid UTF-8".to_string());
    }
    // Latin-1 maps 1:1 onto the first 256 code points; Windows-1252 only
    // differs in the 0x80-0x9F window, translated above.
    let win = encoding != "latin1";
    Ok(bytes
        .iter()
        .map(|byte| {
            if *byte < 0x80 {
                *byte as char
            } else if win {
                windows_1252(*byte)
            } else {
                *byte as char
            }
        })
        .collect::<String>())
}

/// One record, honouring `"` quoting with `""` as an escaped quote.
pub fn split_line(line: &str, sep: char) -> Vec<String> {
    let mut fields = Vec::new();
    let mut current = String::new();
    let mut quoted = false;
    let mut chars = line.chars().peekable();
    while let Some(character) = chars.next() {
        if quoted {
            if character == '"' {
                if chars.peek() == Some(&'"') {
                    current.push('"');
                    chars.next();
                } else {
                    quoted = false;
                }
            } else {
                current.push(character);
            }
        } else if character == '"' {
            quoted = true;
        } else if character == sep {
            fields.push(std::mem::take(&mut current));
        } else {
            current.push(character);
        }
    }
    fields.push(current);
    fields.into_iter().map(|field| field.trim().to_string()).collect()
}

fn parse_date(raw: &str, format: &str) -> Option<String> {
    let digits: Vec<&str> = raw.split(|character: char| !character.is_ascii_digit()).filter(|part| !part.is_empty()).collect();
    let (year, month, day) = match format {
        // "%d-%m/%Y" is the typo 0.2.0 saved for DD-MM-YYYY profiles.
        "%d/%m/%Y" | "%d-%m-%Y" | "%d-%m/%Y" => {
            if digits.len() < 3 {
                return None;
            }
            (digits[2], digits[1], digits[0])
        }
        "%Y-%m-%d" => {
            if digits.len() < 3 {
                return None;
            }
            (digits[0], digits[1], digits[2])
        }
        "%m/%d/%Y" => {
            if digits.len() < 3 {
                return None;
            }
            (digits[2], digits[0], digits[1])
        }
        _ => return None,
    };
    // Extra groups are a time of day; a two-digit year is this century.
    let year = match year.len() {
        2 => format!("20{year}"),
        4 => year.to_string(),
        _ => return None,
    };
    let pad = |part: &str| format!("{part:0>2}");
    let iso = format!("{}-{}-{}", year, pad(month), pad(day));
    NaiveDate::parse_from_str(&iso, "%Y-%m-%d").ok()?;
    Some(iso)
}

fn parse_csv_amount(raw: &str, decimal_sep: &str) -> Option<i64> {
    let compact: String = raw.chars().filter(|character| !character.is_whitespace()).collect();
    if compact.is_empty() {
        return None;
    }
    let (negative, unsigned) = if let Some(rest) = compact.strip_suffix(')') {
        (true, rest.trim_end_matches('(').to_string())
    } else if let Some(rest) = compact.strip_suffix('-') {
        (true, rest.to_string())
    } else {
        (false, compact)
    };
    // Same rule as the OFX amounts: a comma means Brazilian notation.
    let mut canonical = if decimal_sep == "," {
        unsigned.replace('.', "").replace(',', ".")
    } else {
        unsigned.replace(',', "")
    };
    if negative && !canonical.starts_with('-') {
        canonical = format!("-{canonical}");
    }
    crate::ofx::parse_amount_cents(&canonical)
}

/// Turns statement text into dated money plus a list of skipped lines.
/// Skipping is deliberate: bank footers ("SALDO", totals) are not entries.
pub fn parse_csv(text: &str, mapping: &CsvMapping) -> Result<(Vec<CsvRow>, Vec<CsvIssue>), String> {
    validate_mapping(mapping)?;
    let separator = separator_of(mapping)?;
    let mut rows = Vec::new();
    let mut issues = Vec::new();
    let mut first = mapping.has_header;
    let mut line_no = 0;
    for raw_line in text.lines() {
        line_no += 1;
        if raw_line.trim().is_empty() {
            continue;
        }
        if first {
            first = false;
            continue;
        }
        let fields = split_line(raw_line, separator);
        let cell = |index: usize| fields.get(index).map(String::as_str).unwrap_or("");
        let fail = |message: &str| CsvIssue {
            line_no,
            message: message.to_string(),
        };
        let date_raw = cell(mapping.date_col);
        let Some(posted_on) = parse_date(date_raw, &mapping.date_format) else {
            issues.push(fail(&format!("unreadable date: {date_raw}")));
            continue;
        };
        let amount = match (mapping.amount_col, mapping.debit_col, mapping.credit_col) {
            (Some(column), _, _) => parse_csv_amount(cell(column), &mapping.decimal_sep),
            (None, Some(debit), Some(credit)) => {
                let debit = cell(debit);
                let credit = cell(credit);
                match (debit.trim().is_empty(), credit.trim().is_empty()) {
                    (true, true) => {
                        issues.push(fail("debit and credit are both empty"));
                        continue;
                    }
                    (false, true) => parse_csv_amount(debit, &mapping.decimal_sep).map(|value| -value.abs()),
                    (true, false) => parse_csv_amount(credit, &mapping.decimal_sep).map(|value| value.abs()),
                    (false, false) => {
                        issues.push(fail("both debit and credit are filled"));
                        continue;
                    }
                }
            }
            _ => unreachable!("validated above"),
        };
        let Some(amount_cents) = amount else {
            issues.push(fail("unreadable amount"));
            continue;
        };
        if amount_cents == 0 {
            issues.push(fail("zero amount"));
            continue;
        }
        rows.push(CsvRow {
            line_no,
            posted_on,
            description: cell(mapping.description_col).to_string(),
            amount_cents,
        });
    }
    Ok((rows, issues))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dates_accept_time_two_digit_years_and_the_old_typo() {
        assert_eq!(parse_date("05/03/2024 10:22", "%d/%m/%Y").as_deref(), Some("2024-03-05"));
        assert_eq!(parse_date("05/03/24", "%d/%m/%Y").as_deref(), Some("2024-03-05"));
        assert_eq!(parse_date("05-03-2024", "%d-%m/%Y").as_deref(), Some("2024-03-05"));
        assert_eq!(parse_date("05/03/202", "%d/%m/%Y"), None);
    }

    fn mapping() -> CsvMapping {
        CsvMapping {
            separator: ";".to_string(),
            encoding: "auto".to_string(),
            has_header: true,
            date_col: 0,
            date_format: "%d/%m/%Y".to_string(),
            description_col: 2,
            amount_col: Some(3),
            debit_col: None,
            credit_col: None,
            decimal_sep: ",".to_string(),
        }
    }

    const SHEET: &str = "Data;Agencia;Descricao;Valor\n05/03/2024;123;IFD*IFOOD SAO PAULO;-23,90\n10/03/2024;123;SALARIO;1500,00\nSALDO;123;;1476,10\n";

    #[test]
    fn parses_brazilian_sheets_and_skips_footers() {
        let (rows, issues) = parse_csv(SHEET, &mapping()).expect("should parse");
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].posted_on, "2024-03-05");
        assert_eq!(rows[0].amount_cents, -2390);
        assert_eq!(rows[1].amount_cents, 150000);
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].line_no, 4);
    }

    #[test]
    fn parses_day_month_year_with_hyphens() {
        let mapping = CsvMapping {
            date_format: "%d-%m-%Y".to_string(),
            ..mapping()
        };
        let (rows, issues) = parse_csv("Data;Agencia;Descricao;Valor\n05-03-2024;123;PADARIA;-23,90\n", &mapping)
            .expect("should parse");

        assert!(issues.is_empty());
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].posted_on, "2024-03-05");
        assert_eq!(rows[0].amount_cents, -2390);
    }

    #[test]
    fn splits_debit_and_credit_columns() {
        let mapping = CsvMapping {
            amount_col: None,
            debit_col: Some(1),
            credit_col: Some(2),
            ..mapping()
        };
        let text = "Data;Debito;Credito\n05/03/2024;23,90;\n10/03/2024;;1500,00\n11/03/2024;1,00;2,00\n";
        let (rows, issues) = parse_csv(text, &mapping).expect("should parse");
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].amount_cents, -2390);
        assert_eq!(rows[1].amount_cents, 150000);
        assert_eq!(issues.len(), 1);
        assert!(issues[0].message.contains("both debit and credit"));
    }

    #[test]
    fn decodes_latin1_bytes() {
        let mut bytes = b"Data;Descricao;Valor\n05/03/2024;PADARIA P".to_vec();
        bytes.extend_from_slice(&[0xC3, 0x4F]); // Ã O in Latin-1
        bytes.extend_from_slice(b" DE A");
        bytes.push(0xC7); // Ç in Latin-1
        bytes.extend_from_slice("UCAR;-5,00\n".as_bytes());
        let text = decode_bytes(&bytes, "latin1").expect("should decode");
        assert!(text.contains("PADARIA PÃO DE AÇUCAR"));
        let mapping = CsvMapping {
            description_col: 1,
            amount_col: Some(2),
            ..mapping()
        };
        let (rows, issues) = parse_csv(&text, &mapping).expect("should parse");
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].amount_cents, -500);
        assert!(issues.is_empty());
    }

    #[test]
    fn rejects_bad_mappings() {
        let mut bad = mapping();
        bad.separator = ";;".to_string();
        assert!(parse_csv(SHEET, &bad).is_err());
        let mut bad = mapping();
        bad.debit_col = Some(1);
        assert!(parse_csv(SHEET, &bad).is_err());
        let mut bad = mapping();
        bad.date_format = "%Y%m%d".to_string();
        assert!(parse_csv(SHEET, &bad).is_err());
    }

    #[test]
    fn flags_unreadable_cells() {
        let text = "Data;Descricao;Valor\nontem;X;1,00\n05/03/2024;Y;abc\n05/03/2024;Z;0,00\n";
        let mapping = CsvMapping {
            description_col: 1,
            amount_col: Some(2),
            ..mapping()
        };
        let (rows, issues) = parse_csv(text, &mapping).expect("should parse");
        assert!(rows.is_empty());
        assert_eq!(issues.len(), 3);
    }
}
