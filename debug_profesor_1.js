
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://uybiseugdckzadrakfqa.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5YmlzZXVnZGNremFkcmFrZnFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1NzAxMDMsImV4cCI6MjA3ODE0NjEwM30.1pts8rK7cQsWdEb-NvNa39Iz_rZF2OvYVhpTzZnrlqg';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function findProfesor1() {
    console.log('--- FINDING PROFESOR 1 ---');
    const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .ilike('full_name', '%Profesor 1%');

    if (pError) {
        console.error('Error finding profile:', pError);
        return;
    }

    if (!profiles || profiles.length === 0) {
        console.log('No profile found with name "Profesor 1"');
        return;
    }

    for (const prof of profiles) {
        console.log(`\nPROFESSOR: ${prof.full_name} (ID: ${prof.id})`);

        // Check slots
        const { data: slots, error: sError } = await supabase
            .from('class_slots')
            .select('*')
            .eq('professor_id', prof.id);

        if (sError) console.error('Error fetching slots:', sError);
        else {
            console.log(`SLOTS FOUND: ${slots.length}`);
            slots.forEach(s => {
                console.log(`  Day: ${s.day_of_week}, Time: ${s.start_time}, Status: ${s.status}`);
            });
        }

        // Check appointments for next 7 days
        const today = new Date();
        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

        const { data: appointments, error: aError } = await supabase
            .from('appointments')
            .select('*')
            .eq('professor_id', prof.id)
            .gte('class_datetime', today.toISOString())
            .lte('class_datetime', nextWeek.toISOString())
            .neq('status', 'cancelled');

        if (aError) console.error('Error fetching appointments:', aError);
        else {
            console.log(`ACTIVE APPOINTMENTS (Next 7 days): ${appointments.length}`);
            appointments.forEach(a => {
                console.log(`  Class: ${a.class_datetime}, Duration: ${a.duration_minutes}, Status: ${a.status}`);
            });
        }
    }
}

findProfesor1();
