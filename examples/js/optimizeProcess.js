/**
 * Example function to optimize - process array of records
 * This function filters, transforms, and aggregates data
 */
export default function optimizeProcess(records) {
  // Filter out invalid records
  const validRecords = [];
  for (let i = 0; i < records.length; i++) {
    if (records[i] && records[i].status === 'active' && records[i].value > 0) {
      validRecords.push(records[i]);
    }
  }

  // Transform records
  const transformed = [];
  for (let i = 0; i < validRecords.length; i++) {
    const record = validRecords[i];
    transformed.push({
      id: record.id,
      value: record.value * 1.1,
      category: record.category.toUpperCase(),
      processed: true,
    });
  }

  // Group by category
  const grouped = {};
  for (let i = 0; i < transformed.length; i++) {
    const record = transformed[i];
    if (!grouped[record.category]) {
      grouped[record.category] = [];
    }
    grouped[record.category].push(record);
  }

  // Calculate totals per category
  const results = {};
  const categories = Object.keys(grouped);
  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];
    let total = 0;
    const items = grouped[category];
    for (let j = 0; j < items.length; j++) {
      total += items[j].value;
    }
    results[category] = {
      count: items.length,
      total: Math.round(total * 100) / 100,
      average: Math.round((total / items.length) * 100) / 100,
    };
  }

  return results;
}