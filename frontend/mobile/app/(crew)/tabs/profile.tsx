import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ProfileView } from '@/components/common/ProfileView';
import { tasksApi, Task } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { isMine, isOpen } from '@/utils/tasks';

export default function CrewProfile() {
  const userId = useAuthStore((s) => s.user?.userId ?? '');
  const [tasks, setTasks] = useState<Task[]>([]);

  useFocusEffect(
    useCallback(() => {
      tasksApi
        .getAll()
        .then(({ data }) => setTasks((data.tasks ?? []).filter((t) => isMine(t, userId))))
        .catch(() => {});
    }, [userId]),
  );

  const done = tasks.filter((t) => t.status === 'completed').length;
  const open = tasks.filter(isOpen).length;

  return (
    <ProfileView
      role="crew"
      stats={[
        { label: 'ASSIGNED', value: tasks.length },
        { label: 'OPEN', value: open },
        { label: 'COMPLETED', value: done },
      ]}
    />
  );
}
