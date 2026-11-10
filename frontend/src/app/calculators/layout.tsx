import ApprovedCustomerGate from '@/components/ApprovedCustomerGate';
import type {ReactNode} from 'react';
export default function CalculatorsLayout({children}:{children:ReactNode}){
 return <ApprovedCustomerGate>{children}</ApprovedCustomerGate>;
}
