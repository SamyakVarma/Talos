interface BotCardProps {
  name: string;
  description: string;
  image?: string;
  onClick?: () => void;
}
export default function BotCard({ name, description, image, onClick }: BotCardProps) {
    return (
        <div onClick={onClick} className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 hover:border-blue-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10">
        {/* Image or placeholder */}
            <div className="h-32 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                {image ? (
                    <img
                        src={image}
                        alt={name}
                        className="h-full w-full object-cover rounded-lg"
                    />
                    ) : (
                    <div className="text-gray-500 text-sm">No image</div>
                )}
            </div>
        {/* Content */}
            <h3 className="text-xl font-semibold text-white mb-2">{name}</h3>
            <p className="text-gray-400 text-sm">{description}</p>
        </div>
    );
}