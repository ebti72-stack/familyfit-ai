import { View } from 'react-native';
import { useI18n, type StringKey } from '../i18n';
import type { DailyGoals } from '../lib/types';
import { useTheme } from '../state/app';
import { Banner, Card, Icon, Row, Txt } from './ui';
import { Ring } from './viz';

export function GoalsSummary({ goals }: { goals: DailyGoals }) {
  const { t, n } = useI18n();
  const th = useTheme();
  const tile = (label: string, value: string, color: string) => (
    <View style={{ flex: 1, minWidth: 90, backgroundColor: th.surfaceAlt, borderRadius: 16, padding: 12, gap: 2 }}>
      <Row gap={6}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} /><Txt v="caption" muted>{label}</Txt></Row>
      <Txt v="number">{value}</Txt>
    </View>
  );
  return (
    <View style={{ gap: 12 }}>
      <Card tone="deep">
        <Row gap={18}>
          <Ring size={104} stroke={10} progress={1} color={th.gold} gradientTo="#F0CF8A" track="rgba(255,255,255,0.12)">
            <Txt v="number" color="#fff" center>{n(goals.kcal)}</Txt>
            <Txt v="caption" color="rgba(255,255,255,0.7)" center>{t('common.kcal')}</Txt>
          </Ring>
          <View style={{ flex: 1, gap: 6 }}>
            <Row gap={6} align="flex-start"><Icon name="calculator-outline" size={16} color={th.gold} /><Txt v="label" color="#fff" style={{ flex: 1 }}>{t(`goals.method.${goals.isCustom ? 'custom' : goals.method}` as StringKey)}</Txt></Row>
            <Txt v="caption" color="rgba(255,255,255,0.75)">{t('goals.water')}: {n(goals.waterMl)} {t('common.ml')} · {t('goals.steps')}: {n(goals.steps)}</Txt>
          </View>
        </Row>
      </Card>
      <Row gap={8} wrap>
        {tile(t('macro.protein'), `${n(goals.protein)} ${t('common.g')}`, th.protein)}
        {tile(t('macro.carbs'), `${n(goals.carbs)} ${t('common.g')}`, th.carbs)}
        {tile(t('macro.fat'), `${n(goals.fat)} ${t('common.g')}`, th.fat)}
        {tile(t('macro.fiber'), `${n(goals.fiber)} ${t('common.g')}`, th.primary)}
      </Row>
      {goals.notes.map((k) => <Banner key={k} tone={k.includes('conditions') || k.includes('Supervision') ? 'warning' : 'info'} text={t(k as StringKey)} />)}
    </View>
  );
}
