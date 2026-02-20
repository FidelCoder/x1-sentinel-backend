import { ExternalFlags } from '../types/safety';

export const aggregateExternalData = async (_address: string): Promise<ExternalFlags> => {
  return {
    scamLists: [],
    totalFlags: 0
  };
};
