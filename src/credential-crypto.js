import crypto from "node:crypto";
export class CredentialCrypto {
  constructor(key) { this.key = key; }
  encrypt(value) {
    const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv("aes-256-gcm", this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]); const tag = cipher.getAuthTag();
    return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
  }
  decrypt(value) {
    const [version, iv, tag, ciphertext] = value.split("."); if (version !== "v1") throw new Error("Unsupported encrypted credential version");
    const decipher = crypto.createDecipheriv("aes-256-gcm", this.key, Buffer.from(iv, "base64url")); decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
  }
}
