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
    partnerType: 'Official Dallas Cowboys Podcast Partner',
    associatedTeam: 'DAL',
    category: 'media',
    featuredOnHome: true,
    active: true,
    sortOrder: 1,
  },
  {
    name: 'Tank01',
    description: 'Real-time NFL scores, schedules, rosters, statistics and fantasy data powering Ball Knower.',
    websiteUrl: 'https://www.tank01.com/',
    partnerType: 'Official Sports Data Provider',
    associatedTeam: null,
    category: 'data',
    featuredOnHome: false,
    active: true,
    sortOrder: 2,
  },
];

export const activePartners = partners
  .filter(partner => partner.active)
  .sort((left, right) => left.sortOrder - right.sortOrder);

export const homePartners = activePartners.filter(partner => partner.featuredOnHome);

export const partnerSections = [
  {
    id: 'media',
    label: 'Official Media Partners',
    partners: activePartners.filter(partner => partner.category === 'media'),
  },
  {
    id: 'data',
    label: 'Official Sports Data Provider',
    partners: activePartners.filter(partner => partner.category === 'data'),
  },
].filter(section => section.partners.length > 0);
