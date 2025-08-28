import { use } from 'react';
import ChecklistClient from './Client';

export default function ChecklistPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = use(params);
	return <ChecklistClient visitId={id} />;
}


