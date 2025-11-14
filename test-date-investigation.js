async function investigateDates() {
  const apiKey = process.env.JOBNIMBUS_API_KEY_STAMFORD;

  const response = await fetch('https://app.jobnimbus.com/api1/tasks?size=20', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();
  const tasks = Array.isArray(data) ? data : (data.results || []);

  console.log('=== DATE INVESTIGATION ===\n');
  console.log(`Total tasks: ${tasks.length}\n`);

  for (let i = 0; i < Math.min(10, tasks.length); i++) {
    const task = tasks[i];
    console.log(`\nTask ${i + 1}: ${task.name || task.title || 'Unnamed'}`);
    console.log(`  JNID: ${task.jnid}`);
    console.log(`  date_start: ${task.date_start} (type: ${typeof task.date_start})`);
    console.log(`  date_end: ${task.date_end} (type: ${typeof task.date_end})`);
    console.log(`  date_created: ${task.date_created} (type: ${typeof task.date_created})`);

    if (task.date_end && task.date_end < 1577836800) {
      console.log(`  ⚠️ CORRUPTED DATE_END: ${task.date_end} converts to ${new Date(task.date_end * 1000).toISOString()}`);
    }

    if (task.date_start && typeof task.date_start === 'number' && task.date_start < 1577836800) {
      console.log(`  ⚠️ CORRUPTED DATE_START: ${task.date_start} converts to ${new Date(task.date_start * 1000).toISOString()}`);
    }
  }
}

investigateDates().catch(console.error);
