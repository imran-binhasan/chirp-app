import { View, Text, StyleSheet } from 'react-native';

interface UserAvatarProps {
  username?: string;
  size?: number;
}

const COLORS = [
  '#991B1B', // Deep Red
  '#9A3412', // Deep Orange
  '#92400E', // Deep Amber
  '#065F46', // Deep Emerald
  '#155E75', // Deep Cyan
  '#1E40AF', // Deep Blue
  '#3730A3', // Deep Indigo
  '#5B21B6', // Deep Violet
  '#86198F', // Deep Fuchsia
  '#9D174D', // Deep Pink
];

function getAvatarColor(username: string) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLORS.length;
  return COLORS[index];
}

export const UserAvatar = ({ username = '?', size = 40 }: UserAvatarProps) => {
  const initial = username.charAt(0).toUpperCase();
  const backgroundColor = getAvatarColor(username);
  
  return (
    <View 
      style={[
        styles.container, 
        { 
          width: size, 
          height: size, 
          borderRadius: size / 2, 
          backgroundColor 
        }
      ]}
    >
      <Text style={[styles.text, { fontSize: size * 0.45 }]}>
        {initial}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontFamily: 'Outfit_500Medium',
    color: '#FFFFFF',
  },
});
