export interface Partner {
  name: string;
  logo: string;
  description: string;
  websiteUrl: string;
  partnerType: string;
  associatedTeam: string;
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
    active: true,
    sortOrder: 1,
  },
];

export const activePartners = partners
  .filter(partner => partner.active)
  .sort((left, right) => left.sortOrder - right.sortOrder);
