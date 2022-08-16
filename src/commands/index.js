const { Command, Flags } = require('@oclif/core');

const {
  sleep,
  getNotarizationInfo,
  getRequestStatus,
  notarizeApp,
  staple,
} = require('../util');

class NotarizeCliCommand extends Command {
  async run() {
    // eslint-disable-next-line no-shadow
    const { flags } = await this.parse(NotarizeCliCommand);
    process.stdout.write('Uploading file... ');
    const { requestUuid, error } = await notarizeApp(
      flags.file,
      flags['bundle-id'],
      flags['asc-provider'],
      flags.username,
      flags.password,
    );
    if (!requestUuid) {
      console.log('failed');
      console.error(
        `Error: ${error || 'could not upload file for notarization'}`,
      );
      this.exit(1);
    } else {
      console.log('done');
      let requestStatus = 'in progress';

      console.log(`Request UUID is ${requestUuid}`);

      // Sometimes Apple receives the upload and issues a UUID, but is not ready to return request status right away
      // Allow up to 5 retries on error before giving up and calling this an actual failure
      let retries = 0;

      while (requestStatus === 'in progress') {
        process.stdout.write('Waiting for notarization status... ');
        await sleep(10 * 1000);
        requestStatus = await getRequestStatus(
          requestUuid,
          flags.username,
          flags.password,
        ).catch(() => 'error');

        console.log(requestStatus);

        if (requestStatus === 'error' && retries <= 5) {
          retries += 1;
          requestStatus = 'in progress';
        }
      }
      if (requestStatus === 'success' && !flags['no-staple']) {
        await staple(flags.file);
      }
      const notarizationInfo = await getNotarizationInfo(
        requestUuid,
        flags.username,
        flags.password,
      ).catch(() => undefined);
      // eslint-disable-next-line no-unused-expressions
      notarizationInfo
        ? console.log(notarizationInfo)
        : console.error('Error: could not get notarization info');
      if (requestStatus !== 'success') {
        console.error(`Error: could not notarize file`);
        this.exit(1);
      }
    }
  }
}

NotarizeCliCommand.description = `Notarize a macOS app from the command line
`;

NotarizeCliCommand.flags = {
  file: Flags.string({
    description: 'path to the file to notarize',
    required: true,
  }),
  'bundle-id': Flags.string({
    description: 'bundle id of the app to notarize',
    required: true,
    env: 'PRODUCT_BUNDLE_IDENTIFIER',
  }),
  'asc-provider': Flags.string({
    description: 'asc provider to use for app notarization',
    required: false,
  }),
  username: Flags.string({
    description: 'username to use for authentication',
    required: true,
    env: 'NOTARIZE_USERNAME',
  }),
  password: Flags.string({
    description: 'password to use for authentication',
    required: true,
    env: 'NOTARIZE_PASSWORD',
  }),
  'no-staple': Flags.boolean({
    description: 'disable automatic stapling',
    default: () => false,
  }),
  version: Flags.version({ char: 'v' }),
  help: Flags.help({ char: 'h' }),
};

module.exports = NotarizeCliCommand;
