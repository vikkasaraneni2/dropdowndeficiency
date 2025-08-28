"use client";
import { ReactNode, useEffect } from 'react';
import { setupBackgroundSync } from '@/lib/offline';

export function AppProviders({ children }: { children: ReactNode }) {
	useEffect(() => {
		setupBackgroundSync();
	}, []);
	return <>{children}</>;
}


