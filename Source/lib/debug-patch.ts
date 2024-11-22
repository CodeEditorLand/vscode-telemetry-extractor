// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { Property } from "./common-properties";
import { Event, Events } from "./events";

export function patchDebugEvents(currentEvents: Events, eventPrefix: string) {
	const debugProtocolErrorResponse = new Event(
		eventPrefix + "debugProtocolErrorResponse",
	);
	debugProtocolErrorResponse.properties.push(
		new Property("error", "CallstackOrException", "PerformanceAndHealth"),
	);

	const optin = new Event(eventPrefix + "optinstatus");
	optin.properties.push(
		new Property(
			"optin",
			"SystemMetaData",
			"BusinessInsight",
			undefined,
			undefined,
			undefined,
			undefined,
			true,
		),
	);
	currentEvents.dataPoints.push(debugProtocolErrorResponse);
	currentEvents.dataPoints.push(optin);
}
