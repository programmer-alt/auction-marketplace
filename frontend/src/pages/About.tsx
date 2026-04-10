export default function About() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">О нас</h1>
      <div className="prose prose-lg">
        <p className="mb-4">
          Добро пожаловать на Auction Marketplace — современную платформу для проведения онлайн-аукционов.
          Наша миссия — предоставить удобный, безопасный и прозрачный способ покупки и продажи уникальных товаров.
        </p>
        <p className="mb-4">
          Мы объединяем коллекционеров, энтузиастов и обычных пользователей, создавая сообщество,
          где каждый может найти что-то особенное или выставить на торги свои лоты.
        </p>
        <h2 className="text-2xl font-semibold mt-8 mb-4">Наши принципы</h2>
        <ul className="list-disc pl-6 mb-6">
          <li>Прозрачность всех сделок</li>
          <li>Безопасность платежей и данных</li>
          <li>Поддержка пользователей 24/7</li>
          <li>Честные правила аукционов</li>
        </ul>
        <p>
          Если у вас есть вопросы или предложения, пожалуйста, свяжитесь с нашей службой поддержки через страницу <a href="/contacts" className="text-primary-600 hover:underline">Контакты</a>.
        </p>
      </div>
    </div>
  )
}