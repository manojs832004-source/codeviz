/**
 * Interface definition for Language Adapters.
 * Since this is a Javascript codebase, we define this as a base class
 * that all language adapters (Java, Python, C++) must extend and implement.
 */
class BaseLanguageAdapter {
  /**
   * Identifies the language this adapter handles (e.g., 'cpp', 'python', 'java')
   * @returns {string}
   */
  getLanguage() {
    throw new Error('Method not implemented.');
  }

  /**
   * Compiles or prepares the raw code for execution.
   * Throws an error if syntax/compilation fails.
   * @param {string} code 
   * @param {string} [stdin]  Optional custom input to pipe into the program's stdin.
   * @returns {Promise<void>}
   */
  async prepare(code, stdin = '') {
    throw new Error('Method not implemented.');
  }

  /**
   * Executes the prepared code, tracing it step-by-step.
   * Yields StateFrames conforming to the Universal Memory Schema.
   * 
   * A StateFrame has the following structure:
   * {
   *   step: number,
   *   line: number,
   *   stack: Array<{name: string, locals: Record<string, any>}>,
   *   heap: Record<string, any>,
   *   stdout: string
   * }
   * 
   * @param {Object} options 
   * @param {number} options.timeoutMs
   * @param {number} options.maxSteps
   * @returns {AsyncGenerator<Object, void, unknown>}
   */
  async *execute(options) {
    throw new Error('Method not implemented.');
  }

  /**
   * Cleans up any docker containers, temporary files, or child processes.
   * @returns {Promise<void>}
   */
  async cleanup() {
    throw new Error('Method not implemented.');
  }
}

module.exports = BaseLanguageAdapter;