import React, { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { ProfileView } from '@/components/common/ProfileView';
import { useReportStore } from '@/store/reportStore';

export default function CitizenProfile() {
  const myReports = useReportStore((s) => s.myReports);
  const fetchMyReports = useReportStore((s) => s.fetchMyReports);

  useFocusEffect(
    useCallback(() => {
      fetchMyReports();
    }, [fetchMyReports]),
  );

  const resolved = myReports.filter((r) => r.status === 'resolved').length;

  return (
    <ProfileView
      role="citizen"
      stats={[
        { label: 'REPORTS', value: myReports.length },
        { label: 'IN PROGRESS', value: myReports.length - resolved },
        { label: 'RESOLVED', value: resolved },
      ]}
    />
  );
}
