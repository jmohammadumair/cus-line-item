sap.ui.define([], function () {
    "use strict";
    return {
        formatDate: function (sDate) {
            if (!sDate) {
                return "";
            }
            // Parse SAP OData V2 Date format e.g., "/Date(1749081600000)/"
            if (typeof sDate === "string" && sDate.indexOf("/Date(") === 0) {
                var sTime = sDate.substring(6, sDate.length - 2);
                sDate = parseInt(sTime, 10);
            }
            var oDate = new Date(sDate);
            if (isNaN(oDate.getTime())) return "";

            var dd = String(oDate.getDate()).padStart(2, '0');
            var mm = String(oDate.getMonth() + 1).padStart(2, '0');
            var yyyy = oDate.getFullYear();
            return dd + "." + mm + "." + yyyy;
        },

        statusIcon: function (sStatus) {
            if (sStatus === "Open") {
                return "sap-icon://status-negative";
            }
            return "sap-icon://status-positive";
        },

        statusState: function (sStatus) {
            if (sStatus === "Open") {
                return "Error";
            }
            return "Success";
        },

        amountColor: function (fAmount) {
            if (fAmount < 0) {
                return "Error";
            }
            return "None";
        },

        formatAmount: function(fAmount) {
            if (fAmount === null || fAmount === undefined) return "";
            return parseFloat(fAmount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        },

        formatPercent: function(fValue) {
            if (fValue === null || fValue === undefined) return "0%";
            return Math.round(fValue * 100) + "%";
        }
    };
});
