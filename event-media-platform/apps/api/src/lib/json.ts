/**
 * Prisma maps PostgreSQL BIGINT to JS BigInt. Express `res.json()` uses
 * JSON.stringify, which throws "Do not know how to serialize a BigInt"
 * unless we teach BigInt how to serialize.
 */
if (!('toJSON' in BigInt.prototype)) {
  Object.defineProperty(BigInt.prototype, 'toJSON', {
    value(this: bigint) {
      const asNumber = Number(this);
      if (Number.isSafeInteger(asNumber)) return asNumber;
      return this.toString();
    },
    configurable: true,
  });
}
