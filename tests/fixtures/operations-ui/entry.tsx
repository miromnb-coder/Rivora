import {createRoot} from 'react-dom/client';
import {DocumentIntake} from '../../../components/operations/DocumentIntake';
import {OperationQueue} from '../../../components/operations/OperationQueue';
const query=new URLSearchParams(location.search);
const fi=query.get('locale')!=='en';
createRoot(document.getElementById('root')!).render(query.get('view')==='queue'?<OperationQueue fi={fi}/>:<DocumentIntake fi={fi} type={query.get('type')==='po'?'po_pdf_process':'rfq_pdf_process'}/>);
