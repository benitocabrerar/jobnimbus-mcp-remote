/**
 * Data Compaction Utilities
 * Reduces response sizes by extracting only essential fields
 * Prevents Claude Desktop from hitting token limits with large responses
 */

/**
 * Compact Activity - Reduce from ~800 chars to ~150 chars per activity
 */
export interface CompactActivity {
  jnid: string;
  type: string;
  date: string;
  created_by: string;
  note_preview: string;
  related_to: string;
  related_type?: string;
  job_id?: string | null;
  job_number?: string;
  sales_rep?: string;
}

export function compactActivity(activity: any): CompactActivity {
  // OPTIMIZED: Reduced from 200 to 100 chars to reduce response size
  const notePreview = truncateText(stripHtml(activity.note), 100);
  const relatedName = activity.primary?.name || 'Unknown';
  const relatedType = activity.primary?.type;
  const jobId = relatedType === 'job' ? activity.primary?.id : null;
  const jobNumber = relatedType === 'job' ? activity.primary?.number : null;

  return {
    jnid: activity.jnid,
    type: activity.record_type_name || activity.type || 'Activity',
    date: formatUnixDate(activity.date_created),
    created_by: activity.created_by_name || 'Unknown',
    note_preview: notePreview,
    related_to: relatedName,
    related_type: relatedType,
    job_id: jobId,
    job_number: jobNumber,
    sales_rep: activity.sales_rep_name,
  };
}

/**
 * Compact Job - Reduce from ~600 chars to ~200 chars per job
 */
export interface CompactJob {
  jnid: string;
  number: string;
  name: string;
  status: string;
  address: string;
  sales_rep?: string;
  date_created: string;
  last_estimate?: number;
  last_invoice?: number;
  customer_name?: string;
}

export function compactJob(job: any): CompactJob {
  const addressParts = [
    job.address_line1,
    job.city,
    job.state_text,
  ].filter(Boolean);

  const address = addressParts.length > 0
    ? addressParts.join(', ')
    : 'No address';

  return {
    jnid: job.jnid,
    number: job.number || job.display_number || 'N/A',
    name: job.name || job.display_name || 'Unnamed Job',
    status: job.status_name || 'Unknown',
    address,
    sales_rep: job.sales_rep_name,
    date_created: formatUnixDate(job.date_created),
    last_estimate: job.last_estimate || 0,
    last_invoice: job.last_invoice || 0,
    customer_name: job.primary?.name,
  };
}

/**
 * Compact Contact - Reduce from ~400 chars to ~120 chars per contact
 */
export interface CompactContact {
  jnid: string;
  number: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  type?: string;
  date_created: string;
}

export function compactContact(contact: any): CompactContact {
  return {
    jnid: contact.jnid,
    number: contact.number || contact.display_number || 'N/A',
    name: contact.name || contact.display_name || 'Unnamed Contact',
    email: contact.email || contact.email_1,
    phone: contact.mobile_phone || contact.home_phone || contact.work_phone,
    company: contact.company_name,
    type: contact.record_type_name,
    date_created: formatUnixDate(contact.date_created),
  };
}

/**
 * Compact Estimate - Essential estimate information
 */
export interface CompactEstimate {
  jnid: string;
  number: string;
  name: string;
  status: string;
  total: number;
  date_created: string;
  date_sent?: string;
  date_approved?: string;
  job_name?: string;
  customer_name?: string;
}

export function compactEstimate(estimate: any): CompactEstimate {
  return {
    jnid: estimate.jnid,
    number: estimate.number || estimate.display_number || 'N/A',
    name: estimate.name || estimate.display_name || 'Unnamed Estimate',
    status: estimate.status_name || 'Unknown',
    total: estimate.total || 0,
    date_created: formatUnixDate(estimate.date_created),
    date_sent: estimate.date_sent ? formatUnixDate(estimate.date_sent) : undefined,
    date_approved: estimate.date_approved ? formatUnixDate(estimate.date_approved) : undefined,
    job_name: estimate.primary?.name,
    customer_name: estimate.customer?.name,
  };
}

/**
 * Compact User - Essential user/team member information
 */
export interface CompactUser {
  jnid: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role?: string;
  status?: string;
  is_active?: boolean;
  last_login?: string;
  date_created: string;
}

export function compactUser(user: any): CompactUser {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') ||
                   user.display_name ||
                   user.name ||
                   'Unnamed User';

  return {
    jnid: user.jnid,
    email: user.email || 'N/A',
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    full_name: fullName,
    role: user.role || user.user_role,
    status: user.status_name || user.status,
    is_active: user.is_active || user.active,
    last_login: user.last_login ? formatUnixDate(user.last_login) : undefined,
    date_created: formatUnixDate(user.date_created),
  };
}

/**
 * Format Unix timestamp to readable date (YYYY-MM-DD)
 */
export function formatUnixDate(timestamp: number | undefined | null): string {
  if (!timestamp || timestamp === 0) {
    return 'N/A';
  }

  try {
    const date = new Date(timestamp * 1000);
    return date.toISOString().split('T')[0];
  } catch (error) {
    return 'Invalid Date';
  }
}

/**
 * Format Unix timestamp to readable datetime (YYYY-MM-DD HH:MM)
 */
export function formatUnixDateTime(timestamp: number | undefined | null): string {
  if (!timestamp || timestamp === 0) {
    return 'N/A';
  }

  try {
    const date = new Date(timestamp * 1000);
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.toTimeString().split(' ')[0].substring(0, 5);
    return `${dateStr} ${timeStr}`;
  } catch (error) {
    return 'Invalid Date';
  }
}

/**
 * Truncate text to max length and add ellipsis
 */
export function truncateText(text: string | undefined | null, maxLength: number): string {
  if (!text) {
    return '';
  }

  const trimmed = text.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return trimmed.substring(0, maxLength).trim() + '...';
}

/**
 * Strip HTML tags from text (for note fields that contain HTML)
 */
export function stripHtml(html: string | undefined | null): string {
  if (!html) {
    return '';
  }

  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, '');

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"');

  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * Calculate response size estimate in KB
 */
export function estimateResponseSize(data: any): number {
  try {
    const json = JSON.stringify(data);
    const sizeInBytes = new Blob([json]).size;
    return Math.round(sizeInBytes / 1024);
  } catch (error) {
    return 0;
  }
}

/**
 * Check if response is too large (>50KB)
 */
export function isResponseTooLarge(data: any): boolean {
  const sizeKB = estimateResponseSize(data);
  return sizeKB > 50;
}

/**
 * Compact array of items based on type
 */
export function compactArray<T>(
  items: any[],
  compactor: (item: any) => T
): T[] {
  return items.map(compactor);
}

/**
 * Get size reduction percentage
 */
export function getSizeReduction(originalSize: number, compactSize: number): number {
  if (originalSize === 0) return 0;
  return Math.round(((originalSize - compactSize) / originalSize) * 100);
}
