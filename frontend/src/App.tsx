import { Routes, Route, Navigate } from "react-router-dom";

import PublicLayout from "./public-site/PublicLayout";
import HomePage from "./public-site/HomePage";
import SearchResultsPage from "./public-site/SearchResultsPage";
import PartnerDetailPage from "./public-site/PartnerDetailPage";
import MapPage from "./public-site/MapPage";
import FavoritesPage from "./public-site/FavoritesPage";

import { AdminSessionProvider } from "./admin/AdminSessionContext";
import AdminLoginPage from "./admin/AdminLoginPage";
import AdminLayout from "./admin/AdminLayout";
import DashboardPage from "./admin/DashboardPage";
import PartnersListPage from "./admin/PartnersListPage";
import PartnerFormPage from "./admin/PartnerFormPage";
import AgreementsOverviewPage from "./admin/AgreementsOverviewPage";
import CategoriesPage from "./admin/CategoriesPage";
import UploadsPage from "./admin/UploadsPage";
import UploadJobDetailPage from "./admin/UploadJobDetailPage";
import AiReviewPage from "./admin/AiReviewPage";
import AiReviewDetailPage from "./admin/AiReviewDetailPage";
import ExcelUploadPage from "./admin/ExcelUploadPage";
import ExcelJobDetailPage from "./admin/ExcelJobDetailPage";
import AdminSettingsPage from "./admin/AdminSettingsPage";

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchResultsPage />} />
        <Route path="/category/:category" element={<SearchResultsPage />} />
        <Route path="/partners/:id" element={<PartnerDetailPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
      </Route>

      <Route
        path="/admin/*"
        element={
          <AdminSessionProvider>
            <Routes>
              <Route path="login" element={<AdminLoginPage />} />
              <Route element={<AdminLayout />}>
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="partners" element={<PartnersListPage />} />
                <Route path="partners/new" element={<PartnerFormPage />} />
                <Route path="partners/:id" element={<PartnerFormPage />} />
                <Route path="agreements" element={<AgreementsOverviewPage />} />
                <Route path="categories" element={<CategoriesPage />} />
                <Route path="uploads" element={<UploadsPage />} />
                <Route path="uploads/:jobId" element={<UploadJobDetailPage />} />
                <Route path="ai-review" element={<AiReviewPage />} />
                <Route path="ai-review/:id" element={<AiReviewDetailPage />} />
                <Route path="excel" element={<ExcelUploadPage />} />
                <Route path="excel/:jobId" element={<ExcelJobDetailPage />} />
                <Route path="settings" element={<AdminSettingsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
            </Routes>
          </AdminSessionProvider>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
