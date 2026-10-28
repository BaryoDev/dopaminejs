export class DopamineError extends Error {
    constructor(code, message) {
        super(message || code);
        this.name = 'DopamineError';
        this.code = code;
    }
}
