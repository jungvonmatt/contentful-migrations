const { confirm, STORAGE_TAG, STORAGE_CONTENT, STATE_SUCCESS, STATE_FAILURE } = require('./config');

jest.mock('enquirer', () => ({
  Confirm: jest.fn(),
}));

describe('config', () => {
  describe('constants', () => {
    it('should export STORAGE_TAG', () => {
      expect(STORAGE_TAG).toBe('tag');
    });

    it('should export STORAGE_CONTENT', () => {
      expect(STORAGE_CONTENT).toBe('content');
    });

    it('should export STATE_SUCCESS', () => {
      expect(STATE_SUCCESS).toBe('success');
    });

    it('should export STATE_FAILURE', () => {
      expect(STATE_FAILURE).toBe('failure');
    });
  });

  // Note: getConfig tests are skipped because the function uses dynamic imports
  // which are difficult to mock in Jest without --experimental-vm-modules.
  // The function is a thin wrapper around @jungvonmatt/contentful-config which
  // is already tested in its own package.

  describe('confirm', () => {
    let Confirm;
    let mockPromptInstance;

    beforeEach(() => {
      jest.clearAllMocks();
      Confirm = require('enquirer').Confirm;
      mockPromptInstance = {
        run: jest.fn(),
      };
      Confirm.mockImplementation(() => mockPromptInstance);
    });

    it('should return true when yes flag is set', async () => {
      const result = await confirm({ yes: true });

      expect(result).toBe(true);
      expect(Confirm).not.toHaveBeenCalled();
    });

    it('should prompt user when yes flag is not set', async () => {
      mockPromptInstance.run.mockResolvedValue(true);

      const result = await confirm({});

      expect(Confirm).toHaveBeenCalledWith({
        name: 'check',
        message: 'Do you wish to proceed?',
        initial: true,
      });
      expect(mockPromptInstance.run).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should use custom message', async () => {
      mockPromptInstance.run.mockResolvedValue(true);

      await confirm({ message: 'Custom confirmation message' });

      expect(Confirm).toHaveBeenCalledWith({
        name: 'check',
        message: 'Custom confirmation message',
        initial: true,
      });
    });

    it('should return false when user declines', async () => {
      mockPromptInstance.run.mockResolvedValue(false);

      const result = await confirm({});

      expect(result).toBe(false);
    });

    it('should handle prompt errors', async () => {
      const error = new Error('User cancelled prompt');
      mockPromptInstance.run.mockRejectedValue(error);

      await expect(confirm({})).rejects.toThrow('User cancelled prompt');
    });

    it('should work with no config parameter', async () => {
      mockPromptInstance.run.mockResolvedValue(true);

      const result = await confirm();

      expect(Confirm).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });
});
