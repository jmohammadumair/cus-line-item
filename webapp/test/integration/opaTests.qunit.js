/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require(["dashboard/test/integration/AllJourneys"
], function () {
	QUnit.start();
});
