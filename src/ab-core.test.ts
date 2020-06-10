import { genAbTest, genVariant } from './fixtures/ab-test';
import { initCore } from './ab-core';

const initCoreDefaultConfig = {
	mvtMaxValue: 1000000,
	mvtCookieId: 1234,
	pageIsSensitive: false,
	abTestSwitches: {
		DummyTest: true,
		DummyTestException: true,
	},
};

const abTestLibDefault = initCore(initCoreDefaultConfig);

describe('A/B tests', () => {
	beforeEach(() => {
		window.location.hash = '';
	});

	describe('runnableTest', () => {
		test('should return null for an expired test', () => {
			const expiredTest = genAbTest({
				id: 'DummyTest',
				canRun: true,
				expiry: '2000-01-01',
			});
			expect(abTestLibDefault.runnableTest(expiredTest)).toEqual(null);
		});

		test('should return null for a test which is switched off', () => {
			const test = genAbTest({ id: 'DummyTest' });
			const rt = abTestLibDefault.runnableTest(test);
			expect(rt).toBeNull();
		});

		test('should return null if the test cannot be run', () => {
			const test = genAbTest({ id: 'DummyTest', canRun: false });
			expect(abTestLibDefault.runnableTest(test)).toBeNull();
		});

		test('should return null if the test can be run but the variant cannot', () => {
			const test = genAbTest({
				id: 'DummyTest',
				canRun: true,
				expiry: '9999-12-12',
				variants: [genVariant({ id: 'control', canRun: false })],
			});
			expect(abTestLibDefault.runnableTest(test)).toBeNull();
		});

		test('should return null if the mvtId is not in the audience offset', () => {
			const test = genAbTest({
				id: 'DummyTest',
				canRun: true,
				audienceOffset: 0.5,
			});
			expect(abTestLibDefault.runnableTest(test)).toBeNull();
		});

		test('should return true if the mvtId is in the audience offset', () => {
			const abTestLib = initCore({
				...initCoreDefaultConfig,
				...{
					mvtCookieId: 600000,
				},
			});
			const test = genAbTest({
				id: 'DummyTest',
				canRun: true,
				audienceOffset: 0.5,
			});
			expect(abTestLib.runnableTest(test)).not.toBeNull();
		});

		test('should return the forced variant on matching test', () => {
			const abTestLib = initCore({
				...initCoreDefaultConfig,
				...{
					forcedTestVariant: {
						testId: 'DummyTest',
						variant: genVariant({ id: 'variant123', canRun: true }),
					},
				},
			});
			const test = genAbTest({ id: 'DummyTest', canRun: true });
			const rt = abTestLib.runnableTest(test);
			expect(rt).not.toBeNull();
			if (rt) {
				expect(rt.variantToRun).toHaveProperty('id', 'variant123');
			}
		});

		test('should return the variantToRun specified by the cookie, if the test is not the runnableTest param', () => {
			const abTestLib = initCore({
				...initCoreDefaultConfig,
				...{
					forcedTestVariant: {
						testId: 'NotDummyTest',
						variant: genVariant({ id: 'variant123', canRun: true }),
					},
				},
			});
			const test = genAbTest({
				id: 'DummyTest',
				canRun: true,
				variants: [
					genVariant({ id: 'control234', canRun: true }),
					genVariant({ id: 'variant234', canRun: true }),
				],
			});
			const rt = abTestLib.runnableTest(test);
			expect(rt).not.toBeNull();
			if (rt) {
				expect(rt.variantToRun).toHaveProperty('id', 'control234');
			}
		});

		test('should return the variantToRun specified by the cookie, if forced variant is absent (odd cookie)', () => {
			const test = genAbTest({
				id: 'DummyTest',
				canRun: true,
				variants: [
					genVariant({ id: 'control456', canRun: true }),
					genVariant({ id: 'variant456', canRun: true }),
				],
			});
			const rt = abTestLibDefault.runnableTest(test);
			expect(rt).not.toBeNull();
			if (rt) {
				expect(rt.variantToRun).toHaveProperty('id', 'control456');
			}
		});

		test('should return the variantToRun specified by the cookie, if forced variant is absent (even cookie)', () => {
			const abTestLib = initCore({
				...initCoreDefaultConfig,
				...{
					mvtCookieId: 1245,
				},
			});
			const test = genAbTest({
				id: 'DummyTest',
				canRun: true,
				variants: [
					genVariant({ id: 'control789', canRun: true }),
					genVariant({ id: 'variant789', canRun: true }),
				],
			});
			const rt = abTestLib.runnableTest(test);
			expect(rt).not.toBeNull();
			if (rt) {
				expect(rt.variantToRun).toHaveProperty('id', 'variant789');
			}
		});

		test('when forcedTestException is set, it should return null for matching tests and not null for other tests', () => {
			const abTestLib = initCore({
				...initCoreDefaultConfig,
				...{ forcedTestException: 'DummyTestException' },
			});

			const test = genAbTest({ id: 'DummyTest', canRun: true });
			const rt = abTestLib.runnableTest(test);
			expect(rt).not.toBeNull();

			const testException = genAbTest({ id: 'DummyTestException' });
			const rtException = abTestLib.runnableTest(testException);
			expect(rtException).toBeNull();
		});
	});
});
