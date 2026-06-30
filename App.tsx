import React from 'react';
import '@radix-ui/themes/styles.css';
import { Theme } from '@radix-ui/themes';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';

import Home from './src/pages/Home';
import Employees from './src/pages/Employees';
import EmployeeMaster from './src/pages/EmployeeMaster';
import EmployeeDirectory from './src/pages/employees/EmployeeDirectory';
import EmployeeHierarchy from './src/pages/employees/EmployeeHierarchy';
import EmployeeSearch from './src/pages/employees/EmployeeSearch';
import Payroll from './src/pages/Payroll';
import PrePayroll from './src/pages/PrePayroll';
import SalaryPayment from './src/pages/SalaryPayment';
import EmailCommunications from './src/pages/EmailCommunications';
import AttendancePeriodWise from './src/pages/attendance/AttendancePeriodWise';
import AttendanceDaily from './src/pages/attendance/AttendanceDaily';
import AttendanceBulk from './src/pages/attendance/AttendanceBulk';
import Leave from './src/pages/Leave';
import Loans from './src/pages/Loans';
import EmployeeExit from './src/pages/EmployeeExit';
import SalaryRevision from './src/pages/SalaryRevision';
import Reports from './src/pages/Reports';
import EmployeeReports from './src/pages/reports/EmployeeReports';
import EmployeeProfileReport from './src/pages/reports/EmployeeProfileReport';
import EmployeeMISReport from './src/pages/reports/EmployeeMISReport';
import EmployeeDocumentReport from './src/pages/reports/EmployeeDocumentReport';
import TimeManagementReport from './src/pages/reports/TimeManagementReport';
import AttendanceStatement from './src/pages/reports/AttendanceStatement';
import LeaveStatement from './src/pages/reports/LeaveStatement';
import EmployeeLeaveStatus from './src/pages/reports/EmployeeLeaveStatus';
import LossOfPayReport from './src/pages/reports/LossOfPayReport';
import LoanRegister from './src/pages/reports/LoanRegister';
import LoanStatement from './src/pages/reports/LoanStatement';
import LoanStatusReport from './src/pages/reports/LoanStatusReport';
import EmiStatement from './src/pages/reports/EmiStatement';
import LoanApprovalLetter from './src/pages/reports/LoanApprovalLetter';
import DeductionsStatement from './src/pages/reports/DeductionsStatement';
import DeductionsEmployeeReport from './src/pages/reports/DeductionsEmployeeReport';
import PayrollSummaryReports from './src/pages/reports/PayrollSummaryReports';
import PayRunReports from './src/pages/reports/PayRunReports';
import Statements from './src/pages/reports/Statements';
import PeriodReports from './src/pages/reports/PeriodReports';
import PayslipGeneration from './src/pages/reports/PayslipGeneration';
import Form16Generator from './src/pages/reports/Form16Generator';
import BonusRegister from './src/pages/reports/BonusRegister';
import GratuityRegister from './src/pages/reports/GratuityRegister';
import YTDReports from './src/pages/reports/YTDReports';
import StatutoryReports from './src/pages/reports/StatutoryReports';
import RegistersHub from './src/pages/reports/registers/RegistersHub';
import AttendanceRegister from './src/pages/reports/registers/AttendanceRegister';
import WageRegister from './src/pages/reports/registers/WageRegister';
import LeaveRegister from './src/pages/reports/registers/LeaveRegister';
import OvertimeRegister from './src/pages/reports/registers/OvertimeRegister';
import FinesDeductionsRegister from './src/pages/reports/registers/FinesDeductionsRegister';
import ReportGroupHub from './src/pages/reports/ReportGroupHub';
import Settings from './src/pages/Settings';
import SoftwareSettings from './src/pages/SoftwareSettings';
import Configuration from './src/pages/Configuration';
import NotFound from './src/pages/NotFound';
import DeductionEntry from './src/pages/DeductionEntry';
import EmployeeSelfService from './src/pages/EmployeeSelfService';
import Polls from './src/pages/Polls';
import Login from './src/pages/Login';
import SuperAdmin from './src/pages/admin/SuperAdmin';
import IndexRoute from './src/components/IndexRoute';
import ProtectedRoute from './src/components/ProtectedRoute';
import AdminAccessBanner from './src/components/AdminAccessBanner';
import { CurrencyProvider } from './src/context/CurrencyContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';

const App: React.FC = () => {
  return (
    <Theme appearance="light" accentColor="indigo" radius="large">
      <ThemeProvider>
        <CurrencyProvider>
          <AuthProvider>
          <Router>
            <main className="min-h-screen font-sans">
              <Routes>
                <Route path="/login" element={<Login />} />
                {/* Establishment-scoped entry: /SAKTHI, /TESTCO, … → that tenant's
                    login (Username + Password only). Static routes above/below
                    out-rank this dynamic segment, so app paths are unaffected. */}
                <Route path="/:estCode/login" element={<Login />} />
                <Route path="/:estCode" element={<Login />} />
                <Route
                  element={
                    <ProtectedRoute>
                      <AdminAccessBanner />
                      <Outlet />
                    </ProtectedRoute>
                  }
                >
                <Route path="/" element={<IndexRoute />} />
                <Route path="/admin" element={<SuperAdmin />} />
                <Route path="/employees" element={<Employees />} />
                <Route path="/employees/new" element={<EmployeeMaster />} />
                <Route path="/employees/:id/edit" element={<EmployeeMaster />} />
                <Route path="/employees/directory" element={<EmployeeDirectory />} />
                <Route path="/employees/hierarchy" element={<EmployeeHierarchy />} />
                <Route path="/employees/search" element={<EmployeeSearch />} />
                <Route path="/payroll/pre-payroll" element={<PrePayroll />} />
                <Route path="/payroll/salary-payment" element={<SalaryPayment />} />
                <Route path="/email-communications" element={<EmailCommunications />} />
                <Route path="/payroll" element={<Payroll />} />
                <Route path="/attendance/period-wise" element={<AttendancePeriodWise />} />
                <Route path="/attendance/daily" element={<AttendanceDaily />} />
                <Route path="/attendance/bulk" element={<AttendanceBulk />} />
                <Route path="/attendance" element={<AttendancePeriodWise />} />
                <Route path="/leave" element={<Leave />} />
                <Route path="/loans" element={<Loans />} />
                <Route path="/deductions/loan-advances" element={<DeductionEntry category="loan-advances" />} />
                <Route path="/deductions/damages-loss" element={<DeductionEntry category="damages-loss" />} />
                <Route path="/deductions/fines" element={<DeductionEntry category="fines" />} />
                <Route path="/deductions/canteen" element={<DeductionEntry category="canteen" />} />
                <Route path="/deductions/society" element={<DeductionEntry category="society" />} />
                <Route path="/deductions/other-deductions" element={<DeductionEntry category="other-deductions" />} />
                <Route path="/deductions/donations" element={<DeductionEntry category="donations" />} />
                <Route path="/deductions" element={<DeductionEntry />} />
                <Route path="/exit" element={<EmployeeExit />} />
                <Route path="/salary-revision" element={<SalaryRevision />} />
                <Route path="/reports/employee" element={<EmployeeReports />} />
                <Route path="/reports/employee-profile" element={<EmployeeProfileReport />} />
                <Route path="/reports/employee-mis" element={<EmployeeMISReport />} />
                <Route path="/reports/employee-document/:docType" element={<EmployeeDocumentReport />} />
                <Route path="/reports/attendance-statement" element={<AttendanceStatement />} />
                <Route path="/reports/time-management/:metric" element={<TimeManagementReport />} />
                <Route path="/reports/leave-statement" element={<LeaveStatement />} />
                <Route path="/reports/leave-status" element={<EmployeeLeaveStatus />} />
                <Route path="/reports/lop" element={<LossOfPayReport />} />
                <Route path="/reports/loan-register" element={<LoanRegister />} />
                <Route path="/reports/loan-statement" element={<LoanStatement />} />
                <Route path="/reports/loan-status" element={<LoanStatusReport />} />
                <Route path="/reports/emi-statement" element={<EmiStatement />} />
                <Route path="/reports/loan-letter" element={<LoanApprovalLetter />} />
                <Route path="/reports/deductions-statement" element={<DeductionsStatement />} />
                <Route path="/reports/deductions-employee" element={<DeductionsEmployeeReport />} />
                <Route path="/reports/payroll-summary" element={<PayrollSummaryReports />} />
                <Route path="/reports/pay-run" element={<PayRunReports />} />
                <Route path="/reports/statements" element={<Statements />} />
                <Route path="/reports/period" element={<PeriodReports />} />
                <Route path="/reports/payslip-generation" element={<PayslipGeneration />} />
                <Route path="/reports/form16" element={<Form16Generator />} />
                <Route path="/reports/bonus" element={<BonusRegister />} />
                <Route path="/reports/gratuity" element={<GratuityRegister />} />
                <Route path="/reports/ytd" element={<YTDReports />} />
                <Route path="/reports/statutory" element={<StatutoryReports />} />
                <Route path="/reports/registers" element={<RegistersHub />} />
                <Route path="/reports/registers/attendance" element={<AttendanceRegister />} />
                <Route path="/reports/registers/wage" element={<WageRegister />} />
                <Route path="/reports/registers/leave" element={<LeaveRegister />} />
                <Route path="/reports/registers/overtime" element={<OvertimeRegister />} />
                <Route path="/reports/registers/fines-deductions" element={<FinesDeductionsRegister />} />
                <Route path="/reports/statutory/registers" element={<RegistersHub />} />
                <Route path="/reports/statutory/registers/attendance" element={<AttendanceRegister />} />
                <Route path="/reports/statutory/registers/wage" element={<WageRegister />} />
                <Route path="/reports/statutory/registers/leave" element={<LeaveRegister />} />
                <Route path="/reports/statutory/registers/overtime" element={<OvertimeRegister />} />
                <Route path="/reports/statutory/registers/fines-deductions" element={<FinesDeductionsRegister />} />
                <Route path="/reports/g/:groupKey" element={<ReportGroupHub />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/self-service" element={<EmployeeSelfService />} />
                <Route path="/self-service/login" element={<EmployeeSelfService />} />
                <Route path="/polls" element={<Polls />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/settings/software" element={<SoftwareSettings />} />
                <Route path="/configuration" element={<Configuration />} />
                <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
              <ToastContainer
                position="top-right"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
              />
            </main>
          </Router>
          </AuthProvider>
        </CurrencyProvider>
      </ThemeProvider>
    </Theme>
  );
}

export default App;