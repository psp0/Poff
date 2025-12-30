/**
 * Screen Time Rewards Module Unit Tests
 * 
 * 스크린타임 보상 계산 로직을 테스트합니다.
 */

const {
  calculateRewardTier,
  getLastWeekDates,
  parseUsageCode,
  grantItem,
  grantRandomPokemon
} = require('../screen-time-rewards');

jest.mock('../logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Screen Time Rewards Module', () => {
  describe('calculateRewardTier', () => {
    describe('최고 보상 티어 (-40% 이상 감소 또는 2시간 이하)', () => {
      it('-40% 이상 감소 시 최고 보상', () => {
        const tier = calculateRewardTier(-45, 5);

        expect(tier.mysticCharmCount).toBe(5);
        expect(tier.rareCandyCount).toBe(6);
        expect(tier.basePokemonCount).toBe(3);
        expect(tier.ovalCharmCount).toBe(2);
        expect(tier.giveLegendary).toBe(true);
        expect(tier.giveParadoxMythical).toBe(true);
      });

      it('2시간대 이하 사용 시 최고 보상', () => {
        const tier = calculateRewardTier(0, 2);

        expect(tier.giveLegendary).toBe(true);
        expect(tier.giveParadoxMythical).toBe(true);
      });

      it('1시간 사용도 최고 보상', () => {
        const tier = calculateRewardTier(50, 1);

        expect(tier.giveLegendary).toBe(true);
        expect(tier.giveParadoxMythical).toBe(true);
      });
    });

    describe('높은 보상 티어 (-30% ~ -40% 또는 3시간대)', () => {
      it('-30%~-40% 감소 시 전설급 보상', () => {
        const tier = calculateRewardTier(-35, 5);

        expect(tier.mysticCharmCount).toBe(5);
        expect(tier.rareCandyCount).toBe(6);
        expect(tier.basePokemonCount).toBe(3);
        expect(tier.giveLegendary).toBe(true);
        expect(tier.giveParadoxMythical).toBe(false);
      });

      it('3시간대 사용 시 전설급 보상', () => {
        const tier = calculateRewardTier(0, 3);

        expect(tier.giveLegendary).toBe(true);
        expect(tier.giveParadoxMythical).toBe(false);
      });
    });

    describe('중간 보상 티어', () => {
      it('-20%~-30% 감소', () => {
        const tier = calculateRewardTier(-25, 5);

        expect(tier.mysticCharmCount).toBe(4);
        expect(tier.rareCandyCount).toBe(5);
        expect(tier.basePokemonCount).toBe(3);
        expect(tier.ovalCharmCount).toBe(1);
        expect(tier.giveLegendary).toBe(false);
      });

      it('-10%~-20% 감소', () => {
        const tier = calculateRewardTier(-15, 5);

        expect(tier.mysticCharmCount).toBe(3);
        expect(tier.rareCandyCount).toBe(4);
        expect(tier.basePokemonCount).toBe(2);
      });

      it('0~-10% 감소', () => {
        const tier = calculateRewardTier(-5, 5);

        expect(tier.mysticCharmCount).toBe(2);
        expect(tier.rareCandyCount).toBe(3);
        expect(tier.basePokemonCount).toBe(2);
      });
    });

    describe('낮은 보상 티어 (증가)', () => {
      it('0~+10% 증가', () => {
        const tier = calculateRewardTier(5, 5);

        expect(tier.mysticCharmCount).toBe(1);
        expect(tier.rareCandyCount).toBe(3);
        expect(tier.basePokemonCount).toBe(0);
      });

      it('+10%~+20% 증가', () => {
        const tier = calculateRewardTier(15, 5);

        expect(tier.mysticCharmCount).toBe(1);
        expect(tier.rareCandyCount).toBe(2);
      });

      it('+20%~+30% 증가', () => {
        const tier = calculateRewardTier(25, 5);

        expect(tier.mysticCharmCount).toBe(0);
        expect(tier.rareCandyCount).toBe(2);
      });

      it('+30%~+40% 증가', () => {
        const tier = calculateRewardTier(35, 5);

        expect(tier.mysticCharmCount).toBe(1);
        expect(tier.rareCandyCount).toBe(0);
      });
    });

    describe('무보상 티어 (+40% 이상 증가)', () => {
      it('+40% 이상 증가 시 보상 없음', () => {
        const tier = calculateRewardTier(50, 5);

        expect(tier.mysticCharmCount).toBe(0);
        expect(tier.rareCandyCount).toBe(0);
        expect(tier.basePokemonCount).toBe(0);
        expect(tier.ovalCharmCount).toBe(0);
        expect(tier.giveLegendary).toBe(false);
        expect(tier.giveParadoxMythical).toBe(false);
        expect(tier.comparisonResult).toContain('보상 없음');
      });
    });
  });

  describe('getLastWeekDates', () => {
    it('일요일 기준 이전 주 계산', () => {
      // 2025-01-05 (일요일)
      const { lastWeekStart, lastWeekEnd } = getLastWeekDates('2025-01-05');

      expect(lastWeekStart).toBe('2024-12-22');
      expect(lastWeekEnd).toBe('2024-12-28');
    });

    it('수요일 기준 이전 주 계산', () => {
      // 2025-01-01 (수요일)
      const { lastWeekStart, lastWeekEnd } = getLastWeekDates('2025-01-01');

      expect(lastWeekStart).toBe('2024-12-22');
      expect(lastWeekEnd).toBe('2024-12-28');
    });

    it('토요일 기준 이전 주 계산', () => {
      // 2024-12-28 (토요일)
      const { lastWeekStart, lastWeekEnd } = getLastWeekDates('2024-12-28');

      expect(lastWeekStart).toBe('2024-12-15');
      expect(lastWeekEnd).toBe('2024-12-21');
    });

    it('월요일 기준 이전 주 계산', () => {
      // 2024-12-30 (월요일)
      const { lastWeekStart, lastWeekEnd } = getLastWeekDates('2024-12-30');

      expect(lastWeekStart).toBe('2024-12-22');
      expect(lastWeekEnd).toBe('2024-12-28');
    });
  });

  describe('parseUsageCode', () => {
    describe('1~2자리 코드 (분만)', () => {
      it('1자리 (9분)', () => {
        const result = parseUsageCode(9);

        expect(result.hours).toBe(0);
        expect(result.minutes).toBe(9);
        expect(result.error).toBeUndefined();
      });

      it('2자리 (45분)', () => {
        const result = parseUsageCode(45);

        expect(result.hours).toBe(0);
        expect(result.minutes).toBe(45);
      });

      it('2자리 문자열 (30분)', () => {
        const result = parseUsageCode('30');

        expect(result.hours).toBe(0);
        expect(result.minutes).toBe(30);
      });
    });

    describe('3자리 코드', () => {
      it('기본: H:MM 형식 (1시간 30분)', () => {
        const result = parseUsageCode(130);

        expect(result.hours).toBe(1);
        expect(result.minutes).toBe(30);
      });

      it('10시간 이상 플래그: 10H:MM (10시간 15분)', () => {
        const result = parseUsageCode('015', true);

        expect(result.hours).toBe(10);
        expect(result.minutes).toBe(15);
      });

      it('9시간 59분', () => {
        const result = parseUsageCode(959);

        expect(result.hours).toBe(9);
        expect(result.minutes).toBe(59);
      });
    });

    describe('4자리 코드 (HH:MM)', () => {
      it('12시간 30분', () => {
        const result = parseUsageCode(1230);

        expect(result.hours).toBe(12);
        expect(result.minutes).toBe(30);
      });

      it('24시간 정확히', () => {
        const result = parseUsageCode(2400);

        expect(result.hours).toBe(24);
        expect(result.minutes).toBe(0);
        expect(result.error).toBeUndefined();
      });

      it('문자열 코드', () => {
        const result = parseUsageCode('0730');

        expect(result.hours).toBe(7);
        expect(result.minutes).toBe(30);
      });
    });

    describe('유효성 검사', () => {
      it('분이 60 이상이면 에러', () => {
        const result = parseUsageCode(165); // 1시간 65분?

        expect(result.error).toContain('Invalid minutes');
      });

      it('24시간 초과 시 에러', () => {
        const result = parseUsageCode(2401);

        expect(result.error).toContain('exceeds 24 hours');
      });

      it('5자리 이상 코드는 에러', () => {
        const result = parseUsageCode(12345);

        expect(result.error).toContain('Invalid usage code format');
      });
    });
  });

  describe('grantItem', () => {
    let mockClient;

    beforeEach(() => {
      mockClient = {
        query: jest.fn()
      };
    });

    it('수량이 0 이하면 아무것도 하지 않음', async () => {
      await grantItem(mockClient, 'user123', 'Rare Candy', 0);

      expect(mockClient.query).not.toHaveBeenCalled();
    });

    it('아이템이 존재하면 UPSERT 실행', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ item_id: 1 }] }) // SELECT item_id
        .mockResolvedValueOnce({ rows: [] }); // INSERT/UPDATE

      await grantItem(mockClient, 'user123', 'Rare Candy', 5);

      expect(mockClient.query).toHaveBeenCalledTimes(2);
      expect(mockClient.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('SELECT item_id FROM items'),
        ['Rare Candy']
      );
      expect(mockClient.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO user_items'),
        ['user123', 1, 5]
      );
    });

    it('아이템이 존재하지 않으면 INSERT 하지 않음', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await grantItem(mockClient, 'user123', 'NonexistentItem', 5);

      expect(mockClient.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('grantRandomPokemon', () => {
    let mockClient;

    beforeEach(() => {
      mockClient = {
        query: jest.fn()
      };
    });

    it('사용 가능한 포켓몬이 있으면 지급', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ stable_id: 'BULBASAUR' }] }) // SELECT random pokemon
        .mockResolvedValueOnce({ rows: [] }); // INSERT

      const result = await grantRandomPokemon(
        mockClient,
        'user123',
        ['Base'],
        '스크린타임 보상',
        1
      );

      expect(result).toEqual(['BULBASAUR']);
      expect(mockClient.query).toHaveBeenCalledTimes(2);
    });

    it('여러 마리 지급 시 이미 지급된 포켓몬 제외', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ stable_id: 'BULBASAUR' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ stable_id: 'CHARMANDER' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await grantRandomPokemon(
        mockClient,
        'user123',
        ['Base'],
        '스크린타임 보상',
        2
      );

      expect(result).toEqual(['BULBASAUR', 'CHARMANDER']);
    });

    it('사용 가능한 포켓몬이 없으면 빈 배열 반환', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await grantRandomPokemon(
        mockClient,
        'user123',
        ['Mythical'],
        '스크린타임 보상',
        1
      );

      expect(result).toEqual([]);
    });

    it('excludeIds로 특정 포켓몬 제외', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ stable_id: 'CHARMANDER' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await grantRandomPokemon(
        mockClient,
        'user123',
        ['Base'],
        '스크린타임 보상',
        1,
        ['BULBASAUR'] // 제외
      );

      // Query should include BULBASAUR in NOT IN clause
      expect(mockClient.query.mock.calls[0][1]).toContain('BULBASAUR');
      expect(result).toEqual(['CHARMANDER']);
    });

    it('excludeForms가 true면 폼 제외', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ stable_id: 'GIRATINA' }] })
        .mockResolvedValueOnce({ rows: [] });

      await grantRandomPokemon(
        mockClient,
        'user123',
        ['Legendary'],
        '전설 포켓몬 보상',
        1,
        [],
        true // excludeForms
      );

      // Query should include REGEXP exclusion for forms
      expect(mockClient.query.mock.calls[0][0]).toContain('NOT REGEXP');
    });
  });
});
