function checkAlerts(data) {
  const alerts = [];
  if (data.heartRate && data.heartRate > 120) alerts.push('High heart rate');
  if (data.bloodPressure && data.bloodPressure > 140) alerts.push('High blood pressure');
  if (data.oxygen && data.oxygen < 92) alerts.push('Low oxygen saturation');
  if (data.temperature && data.temperature > 38) alerts.push('High temperature');
  return alerts;
}

module.exports = { checkAlerts };
