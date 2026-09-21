import bcrypt from "bcryptjs";
export class BcryptHasher {
    rounds;
    constructor(rounds = 12) {
        this.rounds = rounds;
    }
    hash(value) {
        return bcrypt.hash(value, this.rounds);
    }
    compare(value, hashedValue) {
        return bcrypt.compare(value, hashedValue);
    }
}
