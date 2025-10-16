/**
 * Get Contact Tool
 * Retrieve a specific contact by JNID from JobNimbus
 *
 * Endpoint: GET /api1/contacts/<jnid>
 * Based on JobNimbus API Documentation
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { withCache } from '../../services/cacheService.js';
import { CACHE_PREFIXES, getTTL } from '../../config/cache.js';

interface GetContactInput {
  jnid: string;
}

interface ContactOwner {
  id: string;
}

interface ContactLocation {
  id: number;
  parent_id?: number | null;
  name?: string;
}

interface ContactGeo {
  lat: number;
  lon: number;
}

/**
 * Complete Contact interface matching JobNimbus API
 * Based on official JobNimbus API documentation
 */
interface Contact {
  // Core identifiers
  jnid: string;
  recid: number;
  number?: string;
  type: string;
  customer?: string;

  // Metadata
  created_by: string;
  created_by_name: string;
  date_created: number;
  date_updated: number;

  // Ownership & Location
  owners: ContactOwner[];
  location: ContactLocation;

  // Personal Information
  first_name?: string;
  last_name?: string;
  company?: string;
  description?: string;

  // Contact Information
  email?: string;
  home_phone?: string;
  mobile_phone?: string;
  work_phone?: string;
  fax_number?: string;
  website?: string;

  // Address
  address_line1?: string;
  address_line2?: string | null;
  city?: string;
  state_text?: string;
  country_name?: string;
  zip?: string;
  geo?: ContactGeo;

  // Classification
  record_type: number;
  record_type_name: string;
  status?: number;
  status_name?: string;
  source?: number;
  source_name?: string;

  // Sales
  sales_rep?: string;
  sales_rep_name?: string;

  // Additional
  is_active?: boolean;
  is_archived?: boolean;
  tags?: any[];
  external_id?: string | null;

  // Allow additional fields from API
  [key: string]: any;
}

export class GetContactTool extends BaseTool<GetContactInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_contact',
      description: 'Get contact by JNID',
      inputSchema: {
        type: 'object',
        properties: {
          jnid: {
            type: 'string',
            description: 'Contact JNID',
          },
        },
        required: ['jnid'],
      },
    };
  }

  async execute(input: GetContactInput, context: ToolContext): Promise<any> {
    // Wrap with cache layer
    return await withCache(
      {
        entity: CACHE_PREFIXES.CONTACTS,
        operation: CACHE_PREFIXES.GET,
        identifier: input.jnid,
      },
      getTTL('CONTACT_DETAIL'),
      async () => {
        try {
          // Call JobNimbus API
          const response = await this.client.get(
            context.apiKey,
            `contacts/${input.jnid}`
          );

          const contact: Contact = response.data;

          // Format dates
          const formatDate = (timestamp: number) => {
            if (!timestamp || timestamp === 0) return null;
            return new Date(timestamp * 1000).toISOString();
          };

          // Build full name
          const fullName = [contact.first_name, contact.last_name]
            .filter(Boolean)
            .join(' ') || 'Unnamed Contact';

          // Build address string
          const addressParts = [
            contact.address_line1,
            contact.address_line2,
            contact.city,
            contact.state_text,
            contact.zip,
          ].filter(Boolean);
          const fullAddress = addressParts.length > 0
            ? addressParts.join(', ')
            : null;

          return {
            success: true,
            data: {
              // Identifiers
              jnid: contact.jnid,
              recid: contact.recid,
              number: contact.number || null,
              type: contact.type,
              customer: contact.customer || null,

              // Personal Information
              first_name: contact.first_name || null,
              last_name: contact.last_name || null,
              full_name: fullName,
              company: contact.company || null,
              description: contact.description || null,

              // Contact Information
              email: contact.email || null,
              home_phone: contact.home_phone || null,
              mobile_phone: contact.mobile_phone || null,
              work_phone: contact.work_phone || null,
              fax_number: contact.fax_number || null,
              website: contact.website || null,

              // Address
              address_line1: contact.address_line1 || null,
              address_line2: contact.address_line2 || null,
              city: contact.city || null,
              state_text: contact.state_text || null,
              country_name: contact.country_name || null,
              zip: contact.zip || null,
              full_address: fullAddress,
              geo: contact.geo || null,

              // Classification
              record_type: contact.record_type,
              record_type_name: contact.record_type_name || 'Unknown',
              status: contact.status || null,
              status_name: contact.status_name || null,
              source: contact.source || null,
              source_name: contact.source_name || null,

              // Ownership & Relationships
              owners: contact.owners || [],
              owners_count: contact.owners?.length || 0,
              location: contact.location,

              // Sales
              sales_rep: contact.sales_rep || null,
              sales_rep_name: contact.sales_rep_name || null,

              // Metadata
              created_by: contact.created_by,
              created_by_name: contact.created_by_name,
              date_created: formatDate(contact.date_created),
              date_created_unix: contact.date_created,
              date_updated: formatDate(contact.date_updated),
              date_updated_unix: contact.date_updated,

              // Additional
              is_active: contact.is_active ?? true,
              is_archived: contact.is_archived ?? false,
              tags: contact.tags || [],
              tags_count: contact.tags?.length || 0,
              external_id: contact.external_id || null,

              _metadata: {
                api_endpoint: 'GET /api1/contacts/<jnid>',
                cached: false,
                timestamp: new Date().toISOString(),
              },
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to retrieve contact',
            jnid: input.jnid,
            _metadata: {
              api_endpoint: 'GET /api1/contacts/<jnid>',
              timestamp: new Date().toISOString(),
            },
          };
        }
      }
    );
  }
}

export default new GetContactTool();
