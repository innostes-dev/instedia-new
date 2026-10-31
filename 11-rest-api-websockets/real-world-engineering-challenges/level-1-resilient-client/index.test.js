const { resilientPut } = require('./index.solution.js'); // Point to solution for testing

// Mock global fetch
global.fetch = jest.fn();

describe('resilientPut', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should succeed on the first try', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true })
        });

        const result = await resilientPut('http://test.com', { name: 'Alice' });

        expect(result).toEqual({ success: true });
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
        global.fetch
            .mockResolvedValueOnce({ ok: false, status: 500 }) // Attempt 1 fails
            .mockRejectedValueOnce(new Error('Network Error')) // Attempt 2 fails
            .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) }); // Attempt 3 success

        const startTime = Date.now();
        const result = await resilientPut('http://test.com', {}, 3);
        const elapsed = Date.now() - startTime;

        expect(result).toEqual({ success: true });
        expect(global.fetch).toHaveBeenCalledTimes(3);
        expect(elapsed).toBeGreaterThanOrEqual(300); // 100ms + 200ms
    });

    it('should throw an error after max retries are exhausted', async () => {
        global.fetch.mockResolvedValue({ ok: false, status: 500 });

        await expect(resilientPut('http://test.com', {}, 3)).rejects.toThrow('HTTP Error: 500');
        expect(global.fetch).toHaveBeenCalledTimes(3);
    });
});
