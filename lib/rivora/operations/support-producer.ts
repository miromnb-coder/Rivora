import {createAdminClient} from '@/lib/supabase/admin';
import {operationsEnabled,OperationError} from './policy';
export async function assertSupportProducerEnvironment(){
 // Prevent a preview sharing the production database from creating a production outbox job.
 if(operationsEnabled())return;
 const {data,error}=await createAdminClient().rpc('operation_outbox_active');
 if(error && !['PGRST202','42883'].includes(error.code))throw new OperationError('config');
 if(data===true)throw new OperationError('permission');
}
