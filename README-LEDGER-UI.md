# Confidential Ledger UI

A React-based user interface for a confidential ledger using Pedersen commitments on Ristretto255.

## Features

### 1. Identity Management
- Create keypair identities with custom aliases (e.g., "alice", "bob")
- Identities stored securely in browser localStorage
- Switch between identities to view different perspectives
- Each identity has ed25519 and x25519 keypairs for signing and encryption

### 2. Ledger Spreadsheet
- Create new ledgers with multiple entries
- Each entry consists of:
  - **Holder ID**: The identity that owns this entry
  - **Commitment**: A Pedersen commitment hiding the value
  - **Encrypted Opening**: The value and blinding factor, encrypted to the holder's public key
- Public total is cryptographically verified
- Only the holder can decrypt and view their own balance

### 3. Cryptographic Guarantees
- **Pedersen Commitments**: Hide individual values while allowing verification of totals
- **Ristretto255**: A prime-order group built on Curve25519 for secure commitments
- **ECIES Encryption**: X25519 + HKDF + AES-GCM for encrypting opening values
- **Verifiable Totals**: Anyone can verify that commitments sum correctly without seeing individual values

## Getting Started

```bash
# Navigate to the UI directory
cd ledger-ui

# Install dependencies
bun install

# Start development server
bun dev

# Open browser
# Navigate to http://localhost:5173
```

## Usage

1. **Create Identities**
   - Enter an alias in the Identity Manager sidebar
   - Click "Create" to generate a new keypair
   - The identity is saved to localStorage

2. **Mint a Ledger**
   - Add rows specifying holder IDs and amounts
   - Click "Mint Ledger" to create the ledger
   - All entries are committed and encrypted

3. **View as Different Users**
   - Switch between identities in the sidebar
   - See your decrypted balance when viewing as the holder
   - See only commitments when viewing as others
   - Public total is always visible (if ledger is valid)

## Technology Stack

- **React 19** with TypeScript
- **Vite** for blazing-fast development
- **Tailwind CSS** for styling
- **shadcn/ui** for UI components
- **@noble/curves** for elliptic curve cryptography
- **@noble/hashes** for cryptographic hashing

## Security Notes

⚠️ This is a **proof-of-concept** for educational purposes:

- Keys are stored in browser localStorage (not production-ready)
- No authentication or access control
- No backend - all operations happen client-side
- Not audited for security vulnerabilities

## How It Works

### Pedersen Commitments

A Pedersen commitment allows you to commit to a value `v` without revealing it:

```
C = v*G + r*H
```

Where:
- `G` and `H` are fixed curve points
- `v` is the value being committed
- `r` is a random blinding factor
- `C` is the commitment

**Properties**:
- **Hiding**: Without `r`, you can't determine `v` from `C`
- **Binding**: You can't change `v` after committing
- **Homomorphic**: Commitments add: `C1 + C2 = (v1+v2)*G + (r1+r2)*H`

### Verification

When minting, we create individual commitments and sum them:

```
Sum of commitments = T*G + R*H
```

Where `T` is the total of all values and `R` is the sum of all blinding factors.

Anyone can verify this equation holds without knowing individual values!

## License

MIT
