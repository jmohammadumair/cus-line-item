sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "dashboard/model/formatter",
    "sap/m/MessageToast",
    "sap/m/SelectDialog",
    "sap/m/StandardListItem",
    "sap/m/Dialog",
    "sap/m/Button"
], function (Controller, JSONModel, Filter, FilterOperator, formatter, MessageToast, SelectDialog, StandardListItem, Dialog, Button) {
    "use strict";

    return Controller.extend("dashboard.controller.Main", {
        formatter: formatter,

        onInit: function () {
            // Setup the UI model for state bindings
            var oUIModel = new JSONModel({
                theme: "Fiori Horizon",
                notifications: [],
                showJson: false,
                jsonPayload: "",
                filter: {
                    customer: "",
                    companyCode: "",
                    mode: "Open",
                    keyDate: "2026-12-31",
                    clearingDateFrom: "",
                    clearingDateTo: "",
                    postingDateFrom: "",
                    postingDateTo: "",
                    typeNormal: true,
                    typeSpecialGL: false,
                    typeNoted: false,
                    typeParked: false
                },
                kpi: {
                    openBalanceFormatted: "0.00",
                    clearedBalanceFormatted: "0.00",
                    netExposureFormatted: "0.00",
                    totalItems: 0,
                    debitRatio: 0,
                    creditRatio: 0,
                    debitRatio100: 0,
                    creditRatio100: 0
                },
                search: "",
                tableData: [],
                copilotOutput: "",
                activeFilteredTotal: 0,
                activeFilteredTotalFormatted: "0.00"
            });
            this.getOwnerComponent().setModel(oUIModel, "ui");

            var oPostModel = new JSONModel({
                CompanyCode: "0125",
                Customer: "1000492",
                DocumentDate: new Date().toISOString().substring(0, 10),
                PostingDate: new Date().toISOString().substring(0, 10),
                AmountInCompanyCodeCurrency: 12000,
                CompanyCodeCurrency: "INR",
                TaxCode: "S1",
                BillingDocumentType: "F2",
                SalesOrganization: "5206",
                Status: "Open",
                DocumentItemText: "Simulated transaction ledger post"
            });
            this.getView().setModel(oPostModel, "postModel");

            // Do not load static mock data. Start with empty table.
        },

        onToggleTheme: function() {
            var oUIModel = this.getView().getModel("ui");
            var current = oUIModel.getProperty("/theme");
            oUIModel.setProperty("/theme", current === "Fiori Horizon" ? "Belize Classic" : "Fiori Horizon");
            // Just a simulation, standard sap.ui.core.Theming could be used here
            sap.ui.getCore().applyTheme(current === "Fiori Horizon" ? "sap_belize" : "sap_horizon");
        },

        onToggleNotifications: function() {
            var oUIModel = this.getView().getModel("ui");
            if (oUIModel.getProperty("/notifications").length === 0) {
                oUIModel.setProperty("/notifications", ["Connected to SAP S/4HANA Ledger Engine database."]);
            } else {
                oUIModel.setProperty("/notifications", []);
            }
        },

        onClearNotifications: function() {
            this.getView().getModel("ui").setProperty("/notifications", []);
        },

        onModeChange: function(oEvent) {
            var sMode = oEvent.getSource().data("mode");
            this.getView().getModel("ui").setProperty("/filter/mode", sMode);
        },

        onFilterChange: function() {
            // Do nothing until Execute Search is clicked
        },

        onApplyFilters: function() {
            var oUIModel = this.getView().getModel("ui");
            var oFilter = oUIModel.getProperty("/filter");
            var sCompanyCode = oFilter.companyCode;
            var sCustomer = oFilter.customer;

            if (!sCompanyCode || !sCustomer) {
                sap.m.MessageToast.show("Please enter Customer and Company Code.");
                return;
            }

            sap.ui.core.BusyIndicator.show(0);

            // Fetch from SAP Backend using exact filter URL from backend team
            var sItemsUrl = "/sap/opu/odata/sap/API_GLACCOUNTLINEITEM/GLAccountLineItem?$filter=IsOpenItemManaged eq 'X' and CompanyCode eq '" + sCompanyCode + "' and Customer eq '" + sCustomer + "'&$format=json";
            var sBpUrl = "/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_Customer?$filter=Customer eq '" + sCustomer + "'&$format=json";

            Promise.all([
                fetch(sItemsUrl).then(function(r) { return r.ok ? r.json() : {d:{results:[]}}; }).catch(function(){ return {d:{results:[]}}; }),
                fetch(sBpUrl).then(function(r) { return r.ok ? r.json() : {d:{results:[]}}; }).catch(function(){ return {d:{results:[]}}; })
            ]).then(function(aResponses) {
                var oItemsRes = aResponses[0];
                var oBpRes = aResponses[1];
                
                var aRawItems = (oItemsRes && oItemsRes.d && oItemsRes.d.results) ? oItemsRes.d.results : [];
                var aBp = (oBpRes && oBpRes.d && oBpRes.d.results) ? oBpRes.d.results : [];
                
                var sCustomerName = aBp.length > 0 ? (aBp[0].CustomerName || aBp[0].OrganizationBPName1 || "Unknown Customer") : "Unknown Customer";
                
                var aMappedData = aRawItems.map(function(item) {
                    var oMapped = Object.assign({}, item);
                    var isCleared = (item.ClearingAccountingDocument && item.ClearingAccountingDocument !== "");
                    oMapped.Status = isCleared ? "Cleared" : "Open";
                    oMapped.CustomerName = sCustomerName;
                    oMapped.IsSpecialGL = !!item.SpecialGLCode;
                    oMapped.IsNotedItem = false;
                    oMapped.IsParked = false;
                    return oMapped;
                });
                
                this.getOwnerComponent().getModel("data").setProperty("/", aMappedData);
                this._updateTableData();
                this._updateRawJson();
                
                sap.ui.core.BusyIndicator.hide();
                sap.m.MessageToast.show("Live OData sync complete.");
            }.bind(this));
        },

        onResetFilters: function() {
            var oUIModel = this.getView().getModel("ui");
            oUIModel.setProperty("/filter", {
                customer: "",
                companyCode: "",
                mode: "Open",
                keyDate: "2026-12-31",
                clearingDateFrom: "",
                clearingDateTo: "",
                postingDateFrom: "",
                postingDateTo: "",
                typeNormal: true,
                typeSpecialGL: false,
                typeNoted: false,
                typeParked: false
            });
            oUIModel.setProperty("/search", "");
            oUIModel.setProperty("/tableData", []);
            oUIModel.setProperty("/kpi/openBalanceFormatted", "0.00");
            oUIModel.setProperty("/kpi/clearedBalanceFormatted", "0.00");
            oUIModel.setProperty("/kpi/netExposureFormatted", "0.00");
            oUIModel.setProperty("/kpi/totalItems", 0);
            MessageToast.show("Filter parameters restored.");
        },

        onSearch: function(oEvent) {
            var sQuery = oEvent.getParameter("newValue");
            if (sQuery === undefined) {
                sQuery = oEvent.getParameter("query");
            }
            if (sQuery === undefined) {
                sQuery = oEvent.getSource().getValue();
            }
            this.getView().getModel("ui").setProperty("/search", sQuery);
            this._updateTableData();
        },

        _updateTableData: function() {
            var oDataModel = this.getOwnerComponent().getModel("data");
            var aAllData = oDataModel.getProperty("/");
            if (!aAllData) return;

            var oUIModel = this.getView().getModel("ui");
            var oFilter = oUIModel.getProperty("/filter");
            var sSearch = (oUIModel.getProperty("/search") || "").toLowerCase().trim();

            var aFiltered = aAllData.filter(function(item) {
                // Match Mode
                if (oFilter.mode === "Open" && item.Status !== "Open") return false;
                if (oFilter.mode === "Cleared" && item.Status !== "Cleared") return false;
                // Match Document Types
                if (item.IsSpecialGL && !oFilter.typeSpecialGL) return false;
                if (item.IsNotedItem && !oFilter.typeNoted) return false;
                if (item.IsParked && !oFilter.typeParked) return false;
                if (!item.IsSpecialGL && !item.IsNotedItem && !item.IsParked && !oFilter.typeNormal) return false;

                // Search Box
                if (sSearch) {
                    var bMatch = false;
                    var fields = [
                        item.AccountingDocument,
                        item.FiscalYear,
                        item.BillingDocumentType,
                        item.LedgerGLLineItem,
                        item.PostingDate,
                        item.DocumentDate,
                        item.Customer,
                        item.CustomerName,
                        item.AmountInCompanyCodeCurrency,
                        item.CompanyCodeCurrency,
                        item.TaxCode,
                        item.SalesOrganization,
                        item.DistributionChannel,
                        item.ClearingAccountingDocument,
                        item.ClearingDate,
                        item.DocumentItemText,
                        item.Status
                    ];
                    
                    for (var i = 0; i < fields.length; i++) {
                        var val = fields[i];
                        if (val !== undefined && val !== null) {
                            if (typeof val === "string" && val.toLowerCase().includes(sSearch)) {
                                bMatch = true;
                                break;
                            } else if (typeof val === "number" && String(val).includes(sSearch)) {
                                bMatch = true;
                                break;
                            }
                        }
                    }
                    if (!bMatch) return false;
                }
                return true;
            });

            oUIModel.setProperty("/tableData", aFiltered);
            this._updateKPIs(aFiltered, aAllData);
        },

        _updateKPIs: function(aFiltered, aAllData) {
            var oUIModel = this.getView().getModel("ui");
            
            var fOpen = 0, fCleared = 0;
            // KPI is calculated on aAllData or aFiltered depending on how the simulation wanted.
            // Based on Angular app, OpenBalance is derived from "this.database()" which is aAllData.
            aAllData.forEach(function(i) {
                var fAmt = parseFloat(i.AmountInCompanyCodeCurrency) || 0;
                if(i.Status === "Open") fOpen += fAmt;
                if(i.Status === "Cleared") fCleared += fAmt;
            });
            var fNet = fOpen - fCleared;

            var fTotalAbs = 0;
            var fTotalDebits = 0;
            aAllData.forEach(function(i) {
                var fAmt = parseFloat(i.AmountInCompanyCodeCurrency) || 0;
                fTotalAbs += Math.abs(fAmt);
                if (fAmt > 0) {
                    fTotalDebits += fAmt;
                }
            });

            var fDebitRatio = fTotalAbs ? (fTotalDebits / fTotalAbs) : 0;
            var fCreditRatio = 1 - fDebitRatio;

            oUIModel.setProperty("/kpi/openBalanceFormatted", this.formatter.formatAmount(fOpen));
            oUIModel.setProperty("/kpi/clearedBalanceFormatted", this.formatter.formatAmount(fCleared));
            oUIModel.setProperty("/kpi/netExposureFormatted", this.formatter.formatAmount(fNet));
            oUIModel.setProperty("/kpi/totalItems", aFiltered.length);
            oUIModel.setProperty("/kpi/debitRatio", fDebitRatio);
            oUIModel.setProperty("/kpi/creditRatio", fCreditRatio);
            oUIModel.setProperty("/kpi/debitRatio100", fDebitRatio * 100);
            oUIModel.setProperty("/kpi/creditRatio100", fCreditRatio * 100);

            // Recalculate sum of selected & active items
            this._updateActiveSum();
        },

        _updateActiveSum: function() {
            var oTable = this.byId("lineItemsTable");
            var oUIModel = this.getView().getModel("ui");
            if (!oUIModel) return;

            var aSelectedItems = oTable ? oTable.getSelectedItems() : [];
            var fActiveTotal = 0;

            if (aSelectedItems.length > 0) {
                aSelectedItems.forEach(function(oSelectedItem) {
                    var oContext = oSelectedItem.getBindingContext("ui");
                    if (oContext) {
                        var oRowData = oContext.getObject();
                        var fAmt = parseFloat(oRowData.AmountInCompanyCodeCurrency) || 0;
                        fActiveTotal += fAmt;
                    }
                });
            } else {
                var aFiltered = oUIModel.getProperty("/tableData") || [];
                aFiltered.forEach(function(i) {
                    var fAmt = parseFloat(i.AmountInCompanyCodeCurrency) || 0;
                    fActiveTotal += fAmt;
                });
            }

            oUIModel.setProperty("/activeFilteredTotal", fActiveTotal);
            oUIModel.setProperty("/activeFilteredTotalFormatted", this.formatter.formatAmount(fActiveTotal));
        },

        onSelectionChange: function() {
            this._updateActiveSum();
        },

        _updateRawJson: function() {
            var aData = this.getOwnerComponent().getModel("data").getProperty("/");
            var aClean = aData.map(function(item) {
                var oCopy = Object.assign({}, item);
                delete oCopy.IsSpecialGL;
                delete oCopy.IsNotedItem;
                delete oCopy.IsParked;
                return oCopy;
            });
            var sJson = JSON.stringify({ d: { results: aClean } }, null, 2);
            this.getView().getModel("ui").setProperty("/jsonPayload", sJson);
        },

        // --- Value Helps ---
        onCustomerValueHelp: function() {
            if (!this._oCustomerDialog) {
                this._oCustomerDialog = new SelectDialog({
                    title: "Select Customer Account",
                    items: {
                        path: "bpModel>/A_Customer",
                        template: new StandardListItem({
                            title: "{bpModel>Customer}",
                            description: "{bpModel>CustomerName}"
                        })
                    },
                    search: function(oEvent) {
                        var sValue = oEvent.getParameter("value");
                        var oBinding = oEvent.getSource().getBinding("items");
                        if (sValue) {
                            var oFilter = new Filter([
                                new Filter("Customer", FilterOperator.Contains, sValue),
                                new Filter("CustomerName", FilterOperator.Contains, sValue)
                            ], false);
                            oBinding.filter([oFilter]);
                        } else {
                            oBinding.filter([]);
                        }
                    },
                    confirm: function(oEvent) {
                        var oSelectedItem = oEvent.getParameter("selectedItem");
                        if (oSelectedItem) {
                            this.getView().getModel("ui").setProperty("/filter/customer", oSelectedItem.getTitle());
                        }
                    }.bind(this)
                });
                this.getView().addDependent(this._oCustomerDialog);
            }
            this._oCustomerDialog.open();
        },

        onCompanyCodeValueHelp: function() {
            if (!this._oCCDialog) {
                // var oModel = new JSONModel([{id: "0125", name: "Stefanini Italy & India"}, {id: "5206", name: "Stefanini Brazil"}, {id: "9900", name: "Global Tech"}]);
                this._oCCDialog = new SelectDialog({
                    title: "Select Company Code",
                    items: {
                        path: "bpModel>/A_CustomerCompany",
                        template: new StandardListItem({
                            title: "{bpModel>CompanyCode}",
                            description: "Customer: {bpModel>Customer}"
                        })
                    },
                    search: function(oEvent) {
                        var sValue = oEvent.getParameter("value");
                        var oBinding = oEvent.getSource().getBinding("items");
                        if (sValue) {
                            var oFilter = new Filter([
                                new Filter("CompanyCode", FilterOperator.Contains, sValue),
                                new Filter("Customer", FilterOperator.Contains, sValue)
                            ], false);
                            oBinding.filter([oFilter]);
                        } else {
                            oBinding.filter([]);
                        }
                    },
                    confirm: function(oEvent) {
                        var oSelectedItem = oEvent.getParameter("selectedItem");
                        if (oSelectedItem) {
                            this.getView().getModel("ui").setProperty("/filter/companyCode", oSelectedItem.getTitle());
                        }
                    }.bind(this)
                });
                // this._oCCDialog.setModel(oModel);
                this.getView().addDependent(this._oCCDialog);
            }
            this._oCCDialog.open();
        },

        onClearInvoice: function(oEvent) {
            var oContext = oEvent.getSource().getBindingContext("ui");
            var oItem = oContext.getObject();
            var aData = this.getOwnerComponent().getModel("data").getProperty("/");

            for (var i = 0; i < aData.length; i++) {
                if (aData[i].ID === oItem.ID) {
                    aData[i].Status = "Cleared";
                    aData[i].ClearingAccountingDocument = "20000" + Math.floor(100 + Math.random() * 900);
                    aData[i].ClearingDate = new Date().toISOString().substring(0, 10);
                    break;
                }
            }
            this.getOwnerComponent().getModel("data").setProperty("/", aData);
            this._updateTableData();
            MessageToast.show("Successfully posted payment clearance for Invoice " + oItem.AccountingDocument);
        },

        onCopilotQuery: function(oEvent) {
            var sQuery = oEvent.getSource().data("query") || oEvent.getSource().getText();
            var oDataModel = this.getOwnerComponent().getModel("data");
            var aData = oDataModel.getProperty("/");
            var sReply = "";

            if (sQuery.indexOf('total open balance') > -1) {
                var fTotal = 0;
                var iCount = 0;
                aData.forEach(function(i) {
                    if (i.Status === 'Open' && i.CompanyCode === '0125') {
                        fTotal += i.AmountInCompanyCodeCurrency;
                        iCount++;
                    }
                });
                sReply = "Total Open Items in Company Code 0125 matches to:\n👉 INR " + this.formatter.formatAmount(fTotal) + "\n\nThis balance consists of " + iCount + " active debit documents pending clearing.";
            } else if (sQuery.indexOf('billing documents') > -1) {
                this.getView().getModel("ui").setProperty("/search", "F2");
                this._updateTableData();
                sReply = "I have applied a direct view filter for 'F2' Billing Document Types. Only corresponding documents are now displayed.";
            } else if (sQuery.indexOf('credit') > -1) {
                var aCredits = aData.filter(function(i) { return i.AmountInCompanyCodeCurrency < 0; });
                sReply = "I found " + aCredits.length + " credit/negative adjustment postings in the ledger:\n" + 
                         aCredits.map(function(c) { return "• Doc #" + c.AccountingDocument + ": " + c.AmountInCompanyCodeCurrency + " " + c.CompanyCodeCurrency; }).join('\n');
            } else if (sQuery.indexOf('customer accounts') > -1) {
                var oCustomers = {};
                aData.forEach(function(i) { oCustomers[i.Customer] = i.CustomerName; });
                var aUnique = Object.keys(oCustomers);
                sReply = "Active parsed customer account IDs in memory:\n" + 
                         aUnique.map(function(cId) { return "• ID: " + cId + " (" + oCustomers[cId] + ")"; }).join('\n');
            }

            this.getView().getModel("ui").setProperty("/copilotOutput", sReply);
        },

        onClearCopilot: function() {
            this.getView().getModel("ui").setProperty("/copilotOutput", "");
        },

        onResetDB: function() {
            // Restore from a fresh fetch or a saved original clone
            var oDataModel = this.getOwnerComponent().getModel("data");
            oDataModel.loadData("model/mockData.json").then(function(){
                this._updateTableData();
                MessageToast.show("Ledger state reset back to pristine original response content.");
            }.bind(this));
        },

        onExportCSV: function() {
            var aItems = this.getView().getModel("ui").getProperty("/tableData");
            if (!aItems || aItems.length === 0) {
                MessageToast.show("Export failed: Table is empty.");
                return;
            }

            var sCsv = "CompanyCode,FiscalYear,AccountingDocument,PostingDate,Customer,AmountInCompanyCodeCurrency,CompanyCodeCurrency,TaxCode,BillingDocumentType,Status\n";
            aItems.forEach(function(i) {
                sCsv += i.CompanyCode + "," + i.FiscalYear + "," + i.AccountingDocument + "," + i.PostingDate + "," + i.Customer + "," + i.AmountInCompanyCodeCurrency + "," + i.CompanyCodeCurrency + "," + i.TaxCode + "," + i.BillingDocumentType + "," + i.Status + "\n";
            });

            var blob = new Blob([sCsv], { type: 'text/csv;charset=utf-8;' });
            var url = URL.createObjectURL(blob);
            var link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", "FBL5N_Export.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            MessageToast.show("Exported to CSV successfully.");
        },

        onItemPress: function(oEvent) {
            var oItem = oEvent.getSource();
            var oContext = oItem.getBindingContext("ui");
            if (oContext) {
                var sPath = oContext.getPath();
                var aParts = sPath.split("/");
                var sIndex = aParts[aParts.length - 1];

                var oRouter = this.getOwnerComponent().getRouter();
                oRouter.navTo("RouteDetail", {
                    itemIndex: sIndex
                });
            }
        },

        onOpenPostingModal: function() {
            var oView = this.getView();
            var oDialog = oView.byId("postDialog");
            if (oDialog) {
                oDialog.open();
            }
        },

        onCancelPost: function() {
            this.getView().byId("postDialog").close();
        },

        onSubmitPost: function() {
            var oPostData = this.getView().getModel("postModel").getProperty("/");
            var oDataModel = this.getOwnerComponent().getModel("data");
            var aData = oDataModel.getProperty("/");
            var sDocNum = "1000" + Math.floor(10000 + Math.random() * 90000);
            
            var aCustomers = this.getOwnerComponent().getModel("customers").getProperty("/");
            var oMatchedCust = null;
            if (aCustomers) {
                oMatchedCust = aCustomers.find(function(c) { return c.id === oPostData.Customer; });
            }

            var oNewDoc = {
                "ID": ".1~0L.2~" + oPostData.CompanyCode + ".3~2026.4~" + sDocNum + ".5~000001.6~0L",
                "SourceLedger": "0L",
                "CompanyCode": oPostData.CompanyCode,
                "FiscalYear": "2026",
                "AccountingDocument": sDocNum,
                "LedgerGLLineItem": "000001",
                "Ledger": "0L",
                "PostingDate": oPostData.PostingDate,
                "DocumentDate": oPostData.DocumentDate,
                "AmountInCompanyCodeCurrency": parseFloat(oPostData.AmountInCompanyCodeCurrency),
                "CompanyCodeCurrency": oPostData.CompanyCodeCurrency,
                "TaxCode": oPostData.TaxCode,
                "BillingDocumentType": oPostData.BillingDocumentType,
                "SalesOrganization": oPostData.SalesOrganization,
                "DistributionChannel": "Z1",
                "OrganizationDivision": "Z1",
                "AssignmentReference": "SIMULATED",
                "DocumentItemText": oPostData.DocumentItemText,
                "Customer": oPostData.Customer,
                "CustomerName": oMatchedCust ? oMatchedCust.name : "Simulated Ledger Org",
                "Status": oPostData.Status,
                "IsSpecialGL": false,
                "IsNotedItem": false,
                "IsParked": false
            };

            if (oPostData.Status === "Cleared") {
                oNewDoc.ClearingAccountingDocument = "20000" + Math.floor(100 + Math.random() * 900);
                oNewDoc.ClearingDate = new Date().toISOString().substring(0, 10);
            }

            aData.unshift(oNewDoc);
            oDataModel.setProperty("/", aData);
            this._updateTableData();
            
            this.getView().byId("postDialog").close();
            MessageToast.show("New transaction posting created! Document No. " + sDocNum + " added to database.");
        },

        onDocDetails: function(oEvent) {
            MessageToast.show("Document details drawer for " + oEvent.getSource().getBindingContext("ui").getProperty("AccountingDocument"));
            // In a complete implementation, this would open a dialog or a slide-in side panel with doc details.
        }
    });
});