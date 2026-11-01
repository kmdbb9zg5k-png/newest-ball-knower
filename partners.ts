export interface Partner {
  name: string;
  logo?: string;
  description: string;
  websiteUrl: string;
  partnerType: string;
  associatedTeam: string | null;
  category: 'media' | 'data';
  featuredOnHome: boolean;
  active: boolean;
  sortOrder: number;
}

export const partners: Partner[] = [
  {
    name: 'The Cowboys Playbook 365',
    logo: '/partners/cowboys-playbook-365.jpeg',
    description: 'Cowboys news, analysis and podcast coverage.',
    websiteUrl: 'https://cowboysplaybook365.vercel.app/',
    partnerType: 'Ball Knower Media Partner — Cowboys Coverage',
    associatedTeam: 'DAL',
    category: 'media',
    featuredOnHome: true,
    active: true,
    sortOrder: 1,
  },
  {
    name: 'Tank01',
    description: 'Previously used NFL data provider; the active data feeds use independent sources.',
    websiteUrl: 'https://www.tank01.com/',
    partnerType: 'Historical data provider',
    associatedTeam: null,
    category: 'data',
    featuredOnHome: false,
    active: false,
    sortOrder: 2,
  },
  {
    name: 'nflverse',
    description: 'Published NFL schedules, results and roster data, updated periodically. Data used under CC BY 4.0 with Ball Knower modifications.',
    websiteUrl: 'https://github.com/nflverse/nflverse-data',
    partnerType: 'Open NFL data source',
    associatedTeam: null,
    category: 'data',
    featuredOnHome: false,
    active: true,
    sortOrder: 3,
  },
  {
    name: 'Currents News API',
    description: 'NFL headline and publisher-link previews. Full articles remain on the original publishers’ websites.',
    websiteUrl: 'https://currentsapi.services/',
    partnerType: 'News metadata source',
    associatedTeam: null,
    category: 'data',
    featuredOnHome: false,
    active: true,
    sortOrder: 4,
  },
];

export const activePartners = partners
  .filter(partner => partner.active)
  .sort((left, right) => left.sortOrder - right.sortOrder);

export const homePartners = activePartners.filter(partner => partner.featuredOnHome);

export const partnerSections = [
  {
    id: 'media',
    label: 'Ball Knower Media Partners',
    partners: activePartners.filter(partner => partner.category === 'media'),
  },
  {
    id: 'data',
    label: 'NFL data sources',
    partners: activePartners.filter(partner => partner.category === 'data'),
  },
].filter(section => section.partners.length > 0);
