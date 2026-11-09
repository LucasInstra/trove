//! Minimal OFX reader.
//!
//! Banks ship two dialects: OFX 1.x is SGML, where tags are never closed, and
//! OFX 2.x is plain XML. They carry the same fields, so one lenient tokenizer
//! handles both: every `<TAG>` starts a value that runs until the next `<`.

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OfxAccount {
    pub bank_id: String,
    pub acct_id: String,
    pub acct_type: String,
    pub is_credit_card: bool,
    pub currency: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OfxTransaction {
    pub posted_on: String,
    pub amount_cents: i64,
    pub description: String,
    pub memo: String,
    pub fitid: String,
    pub trntype: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OfxStatement {
    pub account: OfxAccount,
    pub transactions: Vec<OfxTransaction>,
    pub ledger_balance_cents: Option<i64>,
    pub ledger_balance_on: Option<String>,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum OfxError {
    #[error("the file has no OFX body")]
    Empty,
    #[error("the file has no account block (BANKACCTFROM or CCACCTFROM)")]
    NoAccount,
    #[error("the file has no transactions")]
    NoTransactions,
}

/// Tags that end whichever block is being read.
const BLOCK_END: &[&str] = &[
    "BANKACCTFROM",
    "CCACCTFROM",
    "BANKTRANLIST",
    "LEDGERBAL",
    "AVAILBAL",
    "STMTRS",
    "CCSTMTRS",
    "STMTTRNRS",
    "CCSTMTTRNRS",
    "STMTTRN",
];

fn closes_block(tag: &str) -> bool {
    BLOCK_END.contains(&tag)
}

/// Flattens the document into `(TAG, value)` pairs, ignoring closing tags.
fn pairs(text: &str) -> Vec<(String, String)> {
    let mut out = Vec::new();
    let mut cursor = 0usize;
    while cursor < text.len() {
        let Some(open_offset) = text[cursor..].find('<') else {
            break;
        };
        let open = cursor + open_offset;
        let Some(close_offset) = text[open + 1..].find('>') else {
            break;
        };
        let close = open + 1 + close_offset;
        let tag = text[open + 1..close].trim();

        let value_start = close + 1;
        let value_end = text[value_start..]
            .find('<')
            .map(|offset| value_start + offset)
            .unwrap_or(text.len());
        let value = text[value_start..value_end].trim();

        let usable = !tag.is_empty()
            && !tag.starts_with('/')
            && !tag.starts_with('!')
            && !tag.starts_with('?');
        if usable {
            out.push((tag.to_ascii_uppercase(), value.to_string()));
        }
        cursor = value_end;
    }
    out
}

pub fn parse(text: &str) -> Result<OfxStatement, OfxError> {
    let flat = pairs(text);
    if flat.is_empty() {
        return Err(OfxError::Empty);
    }

    let mut currency = "BRL".to_string();
    let mut account: Option<OfxAccount> = None;
    let mut transactions = Vec::new();
    let mut ledger_balance_cents = None;
    let mut ledger_balance_on = None;

    let mut index = 0usize;
    while index < flat.len() {
        let (tag, value) = (&flat[index].0, &flat[index].1);

        match tag.as_str() {
            "CURDEF" => currency = value.to_ascii_uppercase(),
            "BANKACCTFROM" | "CCACCTFROM" => {
                let is_credit_card = tag == "CCACCTFROM";
                let mut bank_id = String::new();
                let mut acct_id = String::new();
                let mut acct_type = String::new();

                let mut cursor = index + 1;
                while cursor < flat.len() && !closes_block(&flat[cursor].0) {
                    match flat[cursor].0.as_str() {
                        "BANKID" | "BRANCHID" => bank_id = flat[cursor].1.clone(),
                        "ACCTID" => acct_id = flat[cursor].1.clone(),
                        "ACCTTYPE" => acct_type = flat[cursor].1.clone(),
                        _ => {}
                    }
                    cursor += 1;
                }

                if account.is_none() && !acct_id.is_empty() {
                    account = Some(OfxAccount {
                        bank_id,
                        acct_id,
                        acct_type,
                        is_credit_card,
                        currency: currency.clone(),
                    });
                }
                index = cursor;
                continue;
            }
            "STMTTRN" => {
                let mut posted_raw = String::new();
                let mut amount_raw = String::new();
                let mut fitid = String::new();
                let mut name = String::new();
                let mut memo = String::new();
                let mut trntype = String::new();

                let mut cursor = index + 1;
                while cursor < flat.len() && !closes_block(&flat[cursor].0) {
                    match flat[cursor].0.as_str() {
                        "DTPOSTED" | "DTUSER" => {
                            if posted_raw.is_empty() {
                                posted_raw = flat[cursor].1.clone();
                            }
                        }
                        "TRNAMT" => amount_raw = flat[cursor].1.clone(),
                        "FITID" => fitid = flat[cursor].1.clone(),
                        "NAME" => name = flat[cursor].1.clone(),
                        "MEMO" => memo = flat[cursor].1.clone(),
                        "TRNTYPE" => trntype = flat[cursor].1.clone(),
                        _ => {}
                    }
                    cursor += 1;
                }

                if let (Some(posted_on), Some(amount_cents)) =
                    (parse_date(&posted_raw), parse_amount_cents(&amount_raw))
                {
                    transactions.push(OfxTransaction {
                        posted_on,
                        amount_cents,
                        description: if name.is_empty() { memo.clone() } else { name },
                        memo,
                        fitid,
                        trntype,
                    });
                }
                index = cursor;
                continue;
            }
            "LEDGERBAL" => {
                let mut amount_raw = String::new();
                let mut as_of_raw = String::new();

                let mut cursor = index + 1;
                while cursor < flat.len() && !closes_block(&flat[cursor].0) {
                    match flat[cursor].0.as_str() {
                        "BALAMT" => amount_raw = flat[cursor].1.clone(),
                        "DTASOF" => as_of_raw = flat[cursor].1.clone(),
                        _ => {}
                    }
                    cursor += 1;
                }

                ledger_balance_cents = parse_amount_cents(&amount_raw);
                ledger_balance_on = parse_date(&as_of_raw);
                index = cursor;
                continue;
            }
            _ => {}
        }

        index += 1;
    }

    let account = account.ok_or(OfxError::NoAccount)?;
    if transactions.is_empty() {
        return Err(OfxError::NoTransactions);
    }

    Ok(OfxStatement {
        account,
        transactions,
        ledger_balance_cents,
        ledger_balance_on,
    })
}

/// Reads the first eight digits of `20240305120000[-3:BRT]` as `2024-03-05`.
pub fn parse_date(raw: &str) -> Option<String> {
    let digits: String = raw
        .chars()
        .filter(|character| character.is_ascii_digit())
        .take(8)
        .collect();
    if digits.len() < 8 {
        return None;
    }
    let date = chrono::NaiveDate::parse_from_str(&digits, "%Y%m%d").ok()?;
    Some(date.format("%Y-%m-%d").to_string())
}

/// Money never becomes a float: `-1.234,56` is `-123456` cents.
pub fn parse_amount_cents(raw: &str) -> Option<i64> {
    let compact: String = raw.chars().filter(|character| !character.is_whitespace()).collect();
    if compact.is_empty() {
        return None;
    }
    let negative = compact.starts_with('-');
    let unsigned = compact.trim_start_matches(['+', '-']);
    if unsigned.is_empty() {
        return None;
    }

    // A comma anywhere means the file is using Brazilian notation, where the
    // dot groups thousands. `1.234,56` becomes `1234.56`, `12,90` becomes `12.90`.
    let canonical = if unsigned.contains(',') {
        unsigned.replace('.', "").replace(',', ".")
    } else {
        unsigned.to_string()
    };

    let (integer_part, fraction_part) = canonical.split_once('.').unwrap_or((&canonical, ""));
    let integer_digits: String = integer_part
        .chars()
        .filter(|character| character.is_ascii_digit())
        .collect();
    let mut fraction_digits: String = fraction_part
        .chars()
        .filter(|character| character.is_ascii_digit())
        .collect();
    if integer_digits.is_empty() && fraction_digits.is_empty() {
        return None;
    }

    fraction_digits.truncate(2);
    while fraction_digits.len() < 2 {
        fraction_digits.push('0');
    }

    let integer_value: i64 = if integer_digits.is_empty() {
        0
    } else {
        integer_digits.parse().ok()?
    };
    let fraction_value: i64 = fraction_digits.parse().ok()?;
    let cents = integer_value.checked_mul(100)?.checked_add(fraction_value)?;
    Some(if negative { -cents } else { cents })
}

fn fold(character: char) -> char {
    match character {
        'á' | 'à' | 'â' | 'ã' | 'ä' | 'Á' | 'À' | 'Â' | 'Ã' | 'Ä' => 'a',
        'é' | 'è' | 'ê' | 'ë' | 'É' | 'È' | 'Ê' | 'Ë' => 'e',
        'í' | 'ì' | 'î' | 'ï' | 'Í' | 'Ì' | 'Î' | 'Ï' => 'i',
        'ó' | 'ò' | 'ô' | 'õ' | 'ö' | 'Ó' | 'Ò' | 'Ô' | 'Õ' | 'Ö' => 'o',
        'ú' | 'ù' | 'û' | 'ü' | 'Ú' | 'Ù' | 'Û' | 'Ü' => 'u',
        'ç' | 'Ç' => 'c',
        'ñ' | 'Ñ' => 'n',
        other => other,
    }
}

/// Upper case, no accents, single spaces. Used to compare descriptions.
pub fn normalize_description(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    let mut pending_space = false;
    for character in raw.chars() {
        let folded = fold(character);
        if folded.is_ascii_alphanumeric() {
            if pending_space && !out.is_empty() {
                out.push(' ');
            }
            out.push(folded.to_ascii_uppercase());
            pending_space = false;
        } else {
            pending_space = true;
        }
    }
    out
}

/// Card statements hide the shop behind an acquirer prefix: `IFD*IFOOD`.
/// Long digit runs are transaction ids, not part of the name.
pub fn merchant_of(description: &str) -> String {
    let trimmed = description.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    let after_prefix = trimmed.rsplit('*').next().unwrap_or(trimmed).trim();
    let candidate = if after_prefix.is_empty() {
        trimmed
    } else {
        after_prefix
    };

    let kept: Vec<&str> = candidate
        .split_whitespace()
        .filter(|word| {
            let digits = word.chars().filter(|character| character.is_ascii_digit()).count();
            let total = word.chars().count();
            !(digits > 0 && digits * 2 >= total)
        })
        .collect();

    let joined = kept.join(" ");
    if joined.is_empty() {
        candidate.to_string()
    } else {
        joined
    }
}

/// The same transaction imported twice must produce the same key. `FITID` is
/// what the standard offers, but not every bank keeps it stable, so the fallback
/// is a fingerprint of the transaction itself.
pub fn dedupe_key(
    account_key: &str,
    fitid: &str,
    posted_on: &str,
    amount_cents: i64,
    description: &str,
) -> String {
    let fitid = fitid.trim();
    if !fitid.is_empty() {
        return format!("fitid|{account_key}|{fitid}");
    }
    format!(
        "hash|{account_key}|{posted_on}|{amount_cents}|{}",
        normalize_description(description)
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    const SGML: &str = "OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS><CODE>0<SEVERITY>INFO</STATUS>
<DTSERVER>20240315120000[-3:BRT]
<LANGUAGE>POR
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1
<STATUS><CODE>0<SEVERITY>INFO</STATUS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>341
<ACCTID>12345-6
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20240301
<DTEND>20240331
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20240305120000[-3:BRT]
<TRNAMT>-23.90
<FITID>202403050001
<NAME>IFD*IFOOD SAO PAULO
<MEMO>Compra aprovada
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20240310
<TRNAMT>1500.00
<FITID>202403100002
<NAME>SALARIO
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>1476.10
<DTASOF>20240331
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
";

    #[test]
    fn reads_the_sgml_dialect() {
        let statement = parse(SGML).expect("should parse");
        assert_eq!(statement.account.bank_id, "341");
        assert_eq!(statement.account.acct_id, "12345-6");
        assert_eq!(statement.account.acct_type, "CHECKING");
        assert!(!statement.account.is_credit_card);
        assert_eq!(statement.account.currency, "BRL");
        assert_eq!(statement.transactions.len(), 2);
        assert_eq!(statement.transactions[0].posted_on, "2024-03-05");
        assert_eq!(statement.transactions[0].amount_cents, -2390);
        assert_eq!(statement.transactions[0].fitid, "202403050001");
        assert_eq!(statement.transactions[1].amount_cents, 150000);
        assert_eq!(statement.ledger_balance_cents, Some(147610));
        assert_eq!(statement.ledger_balance_on.as_deref(), Some("2024-03-31"));
    }

    #[test]
    fn reads_the_xml_dialect() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <CURDEF>BRL</CURDEF>
        <BANKACCTFROM>
          <BANKID>001</BANKID>
          <ACCTID>998877</ACCTID>
          <ACCTTYPE>SAVINGS</ACCTTYPE>
        </BANKACCTFROM>
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>DEBIT</TRNTYPE>
            <DTPOSTED>20240201</DTPOSTED>
            <TRNAMT>-10.50</TRNAMT>
            <FITID>A1</FITID>
            <NAME>PADARIA</NAME>
          </STMTTRN>
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>"#;
        let statement = parse(xml).expect("should parse");
        assert_eq!(statement.account.acct_id, "998877");
        assert_eq!(statement.transactions.len(), 1);
        assert_eq!(statement.transactions[0].amount_cents, -1050);
        assert_eq!(statement.ledger_balance_cents, None);
    }

    #[test]
    fn detects_credit_card_statements() {
        let xml = r#"<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS>
<CURDEF>BRL</CURDEF>
<CCACCTFROM><ACCTID>****1234</ACCTID></CCACCTFROM>
<BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20240110</DTPOSTED>
<TRNAMT>-99.99</TRNAMT><FITID>C1</FITID><NAME>LOJA</NAME></STMTTRN></BANKTRANLIST>
</CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>"#;
        let statement = parse(xml).expect("should parse");
        assert!(statement.account.is_credit_card);
        assert_eq!(statement.account.acct_id, "****1234");
    }

    #[test]
    fn rejects_files_without_transactions() {
        let empty = "<OFX><BANKACCTFROM><BANKID>1</BANKID><ACCTID>2</ACCTID></BANKACCTFROM></OFX>";
        assert_eq!(parse(empty), Err(OfxError::NoTransactions));
        assert_eq!(parse(""), Err(OfxError::Empty));
    }

    #[test]
    fn parses_amounts_without_floating_point() {
        assert_eq!(parse_amount_cents("-23.90"), Some(-2390));
        assert_eq!(parse_amount_cents("1500.00"), Some(150000));
        assert_eq!(parse_amount_cents("0.05"), Some(5));
        assert_eq!(parse_amount_cents("12,90"), Some(1290));
        assert_eq!(parse_amount_cents("1.234,56"), Some(123456));
        assert_eq!(parse_amount_cents("-1.234,56"), Some(-123456));
        assert_eq!(parse_amount_cents("R$ 42"), Some(4200));
        assert_eq!(parse_amount_cents("-7"), Some(-700));
        assert_eq!(parse_amount_cents(""), None);
        assert_eq!(parse_amount_cents("abc"), None);
    }

    #[test]
    fn parses_bank_dates() {
        assert_eq!(parse_date("20240305"), Some("2024-03-05".into()));
        assert_eq!(parse_date("20240305120000[-3:BRT]"), Some("2024-03-05".into()));
        assert_eq!(parse_date("2024-03-05"), Some("2024-03-05".into()));
        assert_eq!(parse_date("oops"), None);
    }

    #[test]
    fn strips_the_acquirer_prefix_from_the_merchant() {
        assert_eq!(merchant_of("IFD*IFOOD SAO PAULO"), "IFOOD SAO PAULO");
        assert_eq!(merchant_of("PIX RECEBIDO 12345678"), "PIX RECEBIDO");
        assert_eq!(merchant_of("PADARIA CENTRAL"), "PADARIA CENTRAL");
        assert_eq!(merchant_of(""), "");
    }

    #[test]
    fn dedupe_key_prefers_fitid_and_falls_back_to_a_fingerprint() {
        let with_fitid = dedupe_key("341-1", "ABC", "2024-03-05", -2390, "Ifood");
        let same_again = dedupe_key("341-1", "ABC", "2024-03-05", -2390, "Ifood");
        assert_eq!(with_fitid, same_again);

        let without = dedupe_key("341-1", "", "2024-03-05", -2390, "IFOOD  SAO PAULO");
        let without_again = dedupe_key("341-1", "", "2024-03-05", -2390, "ifood são paulo");
        assert_eq!(without, without_again);

        let other_amount = dedupe_key("341-1", "", "2024-03-05", -2400, "IFOOD SAO PAULO");
        assert_ne!(without, other_amount);
    }

    #[test]
    fn normalizes_accents_and_punctuation() {
        assert_eq!(normalize_description("Padaria São João, Ltda."), "PADARIA SAO JOAO LTDA");
        assert_eq!(normalize_description("  A   B  "), "A B");
    }
}
