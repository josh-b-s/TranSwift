//! varint.rs — LEB128 varints and zigzag, shared by the blob codecs.

pub fn put_varint(out: &mut Vec<u8>, mut n: u64) {
    while n >= 0x80 {
        out.push((n & 0x7f) as u8 | 0x80);
        n >>= 7;
    }
    out.push(n as u8);
}

/// Maps signed to unsigned so small negatives stay short: 0, -1, 1, -2 become 0, 1, 2, 3.
pub fn zigzag(n: i64) -> u64 { ((n << 1) ^ (n >> 63)) as u64 }

#[cfg(test)]
pub fn read_varint(bytes: &[u8], pos: &mut usize) -> Option<u64> {
    let mut n = 0u64;
    let mut shift = 0;
    loop {
        let byte = *bytes.get(*pos)?;
        *pos += 1;
        n |= u64::from(byte & 0x7f) << shift;
        if byte & 0x80 == 0 { return Some(n); }
        shift += 7;
        if shift > 63 { return None; }
    }
}

#[cfg(test)]
pub fn unzigzag(n: u64) -> i64 { ((n >> 1) as i64) ^ -((n & 1) as i64) }
