sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/ui/model/json/JSONModel",
    "dashboard/model/formatter"
], function (Controller, History, JSONModel, formatter) {
    "use strict";

    return Controller.extend("dashboard.controller.Detail", {
        formatter: formatter,

        onInit: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteDetail").attachPatternMatched(this._onObjectMatched, this);
        },

        _onObjectMatched: function (oEvent) {
            var sItemIndex = oEvent.getParameter("arguments").itemIndex;
            var oUIModel = this.getOwnerComponent().getModel("ui");
            if (!oUIModel) {
                this.getOwnerComponent().getRouter().navTo("RouteMain", {}, true);
                return;
            }
            var aTableData = oUIModel.getProperty("/tableData");
            if (aTableData && aTableData[sItemIndex]) {
                var oRowData = aTableData[sItemIndex];
                var oDetailModel = new JSONModel(oRowData);
                this.getView().setModel(oDetailModel);
                this.getView().bindElement("/");
            } else {
                this.getOwnerComponent().getRouter().navTo("RouteMain", {}, true);
            }
        },

        onNavBack: function () {
            var oHistory = History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                var oRouter = this.getOwnerComponent().getRouter();
                oRouter.navTo("RouteMain", {}, true);
            }
        }
    });
});
