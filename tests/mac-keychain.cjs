// Explicit test-only isolation: never add this switch to the shipped application's startup.
module.exports.testCredentialArgs=process.platform==='darwin'&&process.env.LEAFLIGHT_TEST_MOCK_KEYCHAIN==='1'?['--use-mock-keychain']:[];
