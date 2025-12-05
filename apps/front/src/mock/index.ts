
export interface MockUser {
  id: string;
  email: string;
  nickname: string;
  avatarUrl?: string;
  points: number;
}

export interface MockNovel {
  id: string;
  title: string;
  coverUrl?: string;
  status: 'writing' | 'completed' | 'dropped';
  genre: string;
  wordCount: number;
  updatedAt: string;
  isFavorite?: boolean;
}

export interface MockDashboardSummary {
  totalNovels: number;
  totalWords: number;
  totalChapters: number;
  membershipLabel: string;
  membershipExpireAt: string;
  recentNovels: MockNovel[];
}

export interface MockChapterDetail {
  id: string;
  title: string;
  index: number;
  wordCount: number;
  sceneCount: number;
  content: string;
  currentStoryPoint: string;
  characters: Array<{ name: string; role: string; description: string }>;
  options: Array<{ id: string; text: string; type: string }>;
}

export interface MockRechargePackage {
  id: string;
  name: string;
  points: number;
  price: number;
  isRecommended?: boolean;
}

export interface MockRechargeRecord {
  id: string;
  amount: number;
  points: number;
  status: 'success' | 'pending' | 'failed';
  createdAt: string;
}

export interface MockLoginHistory {
    id: string;
    device: string;
    location: string;
    ip: string;
    time: string;
}

// Mock Functions

export const mockGetCurrentUser = async (token: string): Promise<MockUser> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (token === 'valid_token') {
        resolve({
          id: 'user_123',
          email: 'user@example.com',
          nickname: 'Demo User',
          points: 100,
          avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'
        });
      } else {
        reject(new Error('Invalid token'));
      }
    }, 500);
  });
};

export const mockLogin = async ({ email, password: _password }: any): Promise<{ token: string; user: MockUser }> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (email && _password) {
        resolve({
          token: 'valid_token',
          user: {
            id: 'user_123',
            email,
            nickname: 'Demo User',
            points: 100,
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'
          }
        });
      } else {
        reject(new Error('Invalid credentials'));
      }
    }, 800);
  });
};

export const mockRegister = async ({ email, nickname, password: _password }: any): Promise<{ token: string; user: MockUser }> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        token: 'valid_token',
        user: {
          id: 'user_new',
          email,
          nickname,
          points: 50,
        }
      });
    }, 800);
  });
};

export const mockRequestResetPassword = async (_email: string): Promise<any> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, 500);
  });
};

export const mockGetDashboardSummary = async (): Promise<MockDashboardSummary> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        totalNovels: 12,
        totalWords: 150000,
        totalChapters: 45,
        membershipLabel: 'Pro Member',
        membershipExpireAt: '2025-12-31',
        recentNovels: [
          { id: '1', title: 'The Galaxy Guide', status: 'writing', genre: 'Sci-Fi', wordCount: 12000, updatedAt: '2023-10-01', isFavorite: true },
          { id: '2', title: 'Magic Academy', status: 'completed', genre: 'Fantasy', wordCount: 50000, updatedAt: '2023-09-15', isFavorite: false }
        ]
      });
    }, 600);
  });
};

// Keep track of mock novels in memory for simple interactions
let MOCK_NOVELS: MockNovel[] = [
  { id: '1', title: 'The Galaxy Guide', status: 'writing', genre: 'Sci-Fi', wordCount: 12000, updatedAt: '2023-10-01', isFavorite: true },
  { id: '2', title: 'Magic Academy', status: 'completed', genre: 'Fantasy', wordCount: 50000, updatedAt: '2023-09-15', isFavorite: false },
  { id: '3', title: 'Cyberpunk City', status: 'dropped', genre: 'Cyberpunk', wordCount: 5000, updatedAt: '2023-08-20', isFavorite: true },
  { id: '4', title: 'The Last Dragon', status: 'writing', genre: 'Fantasy', wordCount: 8000, updatedAt: '2023-10-05', isFavorite: false },
  { id: '5', title: 'Mars Colonization', status: 'writing', genre: 'Sci-Fi', wordCount: 15000, updatedAt: '2023-10-10', isFavorite: false }
];

export const mockListNovels = async (filters: { status?: string, q?: string, isFavorite?: boolean }): Promise<MockNovel[]> => {
    return new Promise((resolve) => {
    setTimeout(() => {
      let results = [...MOCK_NOVELS];
      
      if (filters.status && filters.status !== 'all') {
        results = results.filter(n => n.status === filters.status);
      }
      
      if (filters.isFavorite) {
        results = results.filter(n => n.isFavorite);
      }
      
      if (filters.q) {
        const query = filters.q.toLowerCase();
        results = results.filter(n => n.title.toLowerCase().includes(query));
      }
      
      resolve(results);
    }, 600);
  });
};

export const mockDeleteNovel = async (id: string): Promise<any> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            MOCK_NOVELS = MOCK_NOVELS.filter(n => n.id !== id);
            resolve(true);
        }, 500);
    });
};

export const mockToggleFavorite = async (id: string): Promise<boolean> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const novel = MOCK_NOVELS.find(n => n.id === id);
            if (novel) {
                novel.isFavorite = !novel.isFavorite;
                resolve(novel.isFavorite);
            } else {
                resolve(false);
            }
        }, 300);
    });
}

export const mockQuickCreateNovel = async ({ prompt }: any): Promise<{ novelId: string }> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (prompt.length < 10) reject(new Error('Prompt too short'));
            else {
                const newNovel: MockNovel = {
                    id: `new_novel_${  Date.now()}`,
                    title: 'New AI Novel',
                    status: 'writing',
                    genre: 'General',
                    wordCount: 0,
                    updatedAt: new Date().toISOString().split('T')[0],
                    isFavorite: false
                };
                MOCK_NOVELS.unshift(newNovel);
                resolve({ novelId: newNovel.id });
            }
        }, 1000);
    });
};

export const mockGetCurrentChapter = async (_novelId: string): Promise<MockChapterDetail> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                id: 'ch_1',
                title: 'Chapter 1: The Beginning',
                index: 1,
                wordCount: 2500,
                sceneCount: 3,
                content: 'It was a dark and stormy night...',
                currentStoryPoint: 'The protagonist discovers a mysterious artifact.',
                characters: [
                    { name: 'Alex', role: 'Protagonist', description: 'A young explorer.' },
                    { name: 'Zara', role: 'Antagonist', description: 'A rival treasure hunter.' }
                ],
                options: [
                    { id: 'opt_1', text: 'Investigate the noise', type: 'Action' },
                    { id: 'opt_2', text: 'Hide and wait', type: 'Stealth' },
                    { id: 'opt_3', text: 'Call for help', type: 'Dialogue' }
                ]
            });
        }, 600);
    });
};

export const mockChooseChapterOption = async ({ novelId: _novelId, chapterId: _chapterId, optionId: _optionId }: any): Promise<any> => {
    return new Promise((resolve) => setTimeout(resolve, 800));
};

export const mockGetRechargePackages = async (): Promise<MockRechargePackage[]> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve([
                { id: 'pkg_1', name: 'Starter Pack', points: 100, price: 9.9, isRecommended: true },
                { id: 'pkg_2', name: 'Pro Pack', points: 500, price: 49.9 },
                { id: 'pkg_3', name: 'Ultra Pack', points: 1200, price: 99.9 }
            ]);
        }, 300);
    });
};

export const mockGetRechargeRecords = async (): Promise<MockRechargeRecord[]> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve([
                { id: 'rec_1', amount: 9.9, points: 100, status: 'success', createdAt: '2023-10-20' },
                { id: 'rec_2', amount: 49.9, points: 500, status: 'pending', createdAt: '2023-10-22' }
            ]);
        }, 300);
    });
};

export const mockCreateRechargeOrder = async ({ packageId: _packageId }: any): Promise<{ orderId: string }> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({ orderId: `order_${  Date.now()}` });
        }, 1000);
    });
};

export const mockChangePassword = async ({ oldPassword, newPassword: _newPassword }: any): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (oldPassword === 'wrong') reject(new Error('旧密码错误'));
            else resolve(true);
        }, 800);
    });
}

export const mockGetLoginHistory = async (): Promise<MockLoginHistory[]> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve([
                { id: '1', device: 'MacBook Pro', location: 'San Francisco, US', ip: '192.168.1.1', time: 'Just now' },
                { id: '2', device: 'iPhone 14', location: 'San Francisco, US', ip: '192.168.1.2', time: '2 days ago' },
            ]);
        }, 500);
    });
}

export const mockUpdateSecuritySettings = async (_settings: any): Promise<boolean> => {
    return new Promise((resolve) => {
        setTimeout(() => resolve(true), 600);
    });
}
