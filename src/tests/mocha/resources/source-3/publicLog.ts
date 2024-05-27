/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export interface IPropertyData {
	classification: 'SystemMetaData' | 'CallstackOrException' | 'CustomerContent' | 'PublicNonPersonalData' | 'EndUserPseudonymizedInformation';
	purpose: 'PerformanceAndHealth' | 'FeatureInsight' | 'BusinessInsight';
	owner?: string;
	comment?: string;
	expiration?: string;
	endpoint?: string;
	isMeasurement?: boolean;
}

export interface IGDPRProperty {
	owner?: string;
	comment?: string;
	expiration?: string;
	readonly [name: string]: IPropertyData | undefined | IGDPRProperty | string;
}

export type IGDPRPropertyWithoutMetadata<T> = Omit<T, 'owner' | 'comment' | 'expiration'>;

export type ClassifiedEvent<T extends IGDPRProperty> = {
	[k in keyof IGDPRPropertyWithoutMetadata<T>]: any
};

export type StrictPropertyChecker<TEvent, TClassifiedEvent, TError> = keyof TEvent extends keyof TClassifiedEvent ? keyof TClassifiedEvent extends keyof TEvent ? TEvent : TError : TError;

export type StrictPropertyCheckError = 'Type of classified event does not match event properties';

export type StrictPropertyCheck<T extends IGDPRProperty, E> = StrictPropertyChecker<E, ClassifiedEvent<T>, StrictPropertyCheckError>;

export type GDPRClassification<T> = { [_ in keyof T]: IPropertyData | IGDPRProperty | undefined | string };


// The TS parser is looking for two commands, publicLog2 and publicLogError2. They both represent the same thing
export function publicLog2<E extends ClassifiedEvent<T> = never, T extends GDPRClassification<T> = never>(eventName: string, data?: StrictPropertyCheck<T, E>, anonymizeFilePaths?: boolean): void {
    return;
}

export function publicLogError2<E extends ClassifiedEvent<T> = never, T extends GDPRClassification<T> = never>(eventName: string, data?: StrictPropertyCheck<T, E>, anonymizeFilePaths?: boolean): void {
    return;
}