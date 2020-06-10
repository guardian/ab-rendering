import { ABTest, Variant, Runnable, ConfigType, coreAPI } from './types';
// import { getVariantFromLocalStorage } from './ab-local-storage'; // Deprecating from localstorage
import { isExpired } from './lib/time-utils';

export const initCore = (config: ConfigType): coreAPI => {
	const {
		mvtMaxValue,
		mvtCookieId,
		pageIsSensitive,
		abTestSwitches,
		forcedTestVariant,
		forcedTestException,
	} = config;
	// We only take account of a variant's canRun function if it's defined.
	// If it's not, assume the variant can be run.
	const variantCanBeRun = (variant: Variant): boolean => {
		const isInTest = variant.id !== 'notintest';
		if (variant.canRun) {
			return variant.canRun() && isInTest;
		} else {
			return isInTest;
		}
	};

	const testCanBeRun = (test: ABTest): boolean => {
		const expired = isExpired(test.expiry);
		const testShouldShowForSensitive = !!test.showForSensitive;
		const isTestOn = abTestSwitches[test.id] && !!abTestSwitches[test.id];
		const canTestBeRun = !test.canRun || test.canRun();

		// console.log({
		// 	expired,
		// 	pageIsSensitive,
		// 	shouldShowForSensitive,
		// 	isTestOn,
		// 	canTestBeRun,
		// 	testCanRun: test.canRun(),
		// });

		return (
			(pageIsSensitive ? testShouldShowForSensitive : true) &&
			isTestOn &&
			!expired &&
			canTestBeRun
		);
	};

	// Determine whether the user is in the test or not and return the associated
	// variant ID, based on the MVT cookie segmentation.
	//
	// The test population is just a subset of MVT ids. A test population must
	// begin from a specific value. Overlapping test ranges are permitted.
	const computeVariantFromMvtCookie = (test: ABTest): Variant | null => {
		const smallestTestId = mvtMaxValue * test.audienceOffset;
		const largestTestId = smallestTestId + mvtMaxValue * test.audience;

		if (
			mvtCookieId &&
			mvtCookieId > smallestTestId &&
			mvtCookieId <= largestTestId
		) {
			// This mvt test id is in the test range, so allocate it to a test variant.
			return test.variants[mvtCookieId % test.variants.length];
		}

		// We return null if there is no variant that matches the test and variant fot the mvtCookieId
		return null;
	};

	// This is the heart of the A/B testing framework.
	// It turns an ABTest into a Runnable<ABTest>, if indeed the test
	// actually has a variant which could run on this pageview.
	//
	// This function can be called at any time, it should always give the same result for a given pageview.
	const runnableTest: coreAPI['runnableTest'] = (test) => {
		// const fromLocalStorage = getVariantFromLocalStorage(test); // We're deprecating accessing localstorage
		const fromCookie = computeVariantFromMvtCookie(test);
		const fromForcedTest =
			forcedTestVariant?.testId === test.id && forcedTestVariant.variant;
		const forcedOutOfTest = forcedTestException === test.id;
		const variantToRun = fromForcedTest || fromCookie;

		// console.log({
		// 	forcedOutOfTest,
		// 	fromForcedTest,
		// 	variantToRun,
		// 	testCanBeRun: testCanBeRun(test),
		// });

		if (
			!forcedOutOfTest &&
			testCanBeRun(test) &&
			variantToRun &&
			variantCanBeRun(variantToRun)
		) {
			return {
				...test,
				variantToRun,
			};
		}

		// The test and variant isn't runnable, sorry
		return null;
	};

	// please ignore
	const allRunnableTests: coreAPI['allRunnableTests'] = (tests) =>
		tests.reduce<Runnable<ABTest>[]>((prev, currentValue) => {
			// in this pr
			const rt = runnableTest(currentValue); // i will remove these comments
			return rt ? [...prev, rt] : prev; // so that this api can be reviewed seperate
		}, []); // ta

	// Please ignore
	const firstRunnableTest: coreAPI['firstRunnableTest'] = (tests) =>
		tests // in this pr
			.map((test: ABTest) => runnableTest(test)) // I will remove these comments
			.find((rt: Runnable<ABTest> | null) => rt !== null) || null; // so that this API can be reviewed seperate

	return {
		runnableTest,
		allRunnableTests,
		firstRunnableTest,
	};
};
